import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// AI 操作记录（WF-16）：把「对话里由系统自动创建的东西」单独拎出来看。
//
// 🔴 为什么不直接看安全中心的审计日志：那里是全量流水（登录、改权限、发密钥…），
// AI 自动创建的对象混在几百条里根本找不着。而用户真正要回答的问题很具体——
// 「刚才那句话到底给我建了什么？谁建的？成没成？现在在哪？」
//
// 不建新表：数据源仍是 audit_logs（只追加、不可篡改），这里只做**筛选 + 规格化**。
// 新表意味着两处真相，AI 建的东西反而可能只进一处。

/** AI 自动创建类动作 → 展示用的对象类型。key 即 audit_logs.action */
const AI_ACTIONS: Record<string, { object: string; verb: string }> = {
  'workflow.copilot_created': { object: 'workflow', verb: '生成工作流' },
  'workflow.copilot_failed': { object: 'workflow', verb: '生成工作流' },
  'agent.copilot_create': { object: 'agent', verb: '生成 Agent' },
  'agent.copilot_failed': { object: 'agent', verb: '生成 Agent' },
  'skill.copilot_created': { object: 'skill', verb: '起草 Skill' },
  'skill.copilot_failed': { object: 'skill', verb: '起草 Skill' },
  'plugin.copilot_created': { object: 'plugin', verb: '配置 Plugin' },
  'schedule.copilot_created': { object: 'schedule', verb: '创建定时作业' },
}

export const AI_ACTION_KEYS = Object.keys(AI_ACTIONS)

export type AiActivityObject = 'workflow' | 'agent' | 'skill' | 'plugin' | 'schedule'

/**
 * 一次 AI 操作产出的具体对象（WF-27）。
 *
 * 🔴 为什么不是「一条记录一个对象」：一句话往往建出不止一样东西——
 * 建工作流的同时可能起草了 Skill、配了定时。此前列表只给一个「查看」按钮，
 * 直接跳走，用户既不知道这次到底建了什么，也够不着旁边那些。
 *
 * exists=false 的对象仍然列出但不可点：审计是历史，对象可能早被删了；
 * 列出来却点开 404 比不列更糟，所以状态要如实标出来。
 */
export type AiActivityTarget = {
  object: AiActivityObject
  id: string
  /** 对象**当前**的名称；已删除时回落到审计里记的历史名 */
  name: string
  /** 对象当前状态（draft/published…），查不到则为 null */
  status: string | null
  exists: boolean
  /** 是否本条记录直接创建的对象（false = 同一需求下的关联产物） */
  primary: boolean
}

export type AiActivity = {
  id: string
  /** 对象类型，决定图标与跳转路径 */
  object: AiActivityObject
  /** 人话描述的动作，如「生成工作流」 */
  verb: string
  /** 被创建对象的名称；失败时可能为空 */
  name: string | null
  targetId: string | null
  success: boolean
  /** 失败原因 / 体检未通过的摘要，成功时为 null */
  reason: string | null
  /** 触发这次创建的原始需求描述，便于回溯「哪句话建的」 */
  prompt: string | null
  /** 体检结论：null 表示这条记录产生时还没有体检机制 */
  ready: boolean | null
  readinessIssues: number | null
  actorId: string | null
  actorName: string | null
  createdAt: string | null
  /** 这次操作产出的对象清单（含关联产物），供「查看」列出后再打开 */
  targets: AiActivityTarget[]
}

type Row = {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown> | null
  actor_id: string | null
  created_at: string | null
  actor: { name: string | null } | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

function toActivity(r: Row): AiActivity | null {
  const meta = AI_ACTIONS[r.action]
  if (!meta) return null
  const d = r.detail ?? {}
  // 失败有两种记法：动作名带 _failed，或 detail.success === false
  const success = !r.action.endsWith('_failed') && d.success !== false
  return {
    id: r.id,
    object: meta.object as AiActivityObject,
    verb: meta.verb,
    name: str(d.name) ?? str(d.title),
    targetId: r.target_id,
    success,
    reason: success ? null : (str(d.error) ?? str(d.reason) ?? '未记录原因'),
    prompt: str(d.description) ?? str(d.prompt),
    ready: typeof d.ready === 'boolean' ? d.ready : null,
    readinessIssues: typeof d.readinessIssues === 'number' ? d.readinessIssues : null,
    actorId: r.actor_id,
    actorName: r.actor?.name ?? null,
    createdAt: r.created_at,
    targets: [], // 由 listAiActivity 统一补齐（要批量查现状，逐条查会 N+1）
  }
}

/** 对象类型 → 表名与「已删除」的判定方式 */
const OBJECT_TABLE: Record<AiActivityObject, { table: string; soft: boolean }> = {
  workflow: { table: 'workflows', soft: true },
  agent: { table: 'agents', soft: true },
  skill: { table: 'skills', soft: true },
  plugin: { table: 'mcp_servers', soft: true },
  schedule: { table: 'agent_schedules', soft: false }, // 该表无 name/deleted_at，只判存在
}

type LiveRow = { id: string; name?: string | null; status?: string | null; deleted_at?: string | null }

/**
 * 批量查对象现状（每种类型一次查询，避免 N+1）。
 * 查不到的一律当作已删除——审计留着历史，但用户不该被引去点一个 404。
 */
async function fetchLiveObjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wanted: Map<AiActivityObject, Set<string>>,
): Promise<Map<string, LiveRow>> {
  const live = new Map<string, LiveRow>()
  await Promise.all(
    [...wanted.entries()].map(async ([object, ids]) => {
      if (ids.size === 0) return
      const { table, soft } = OBJECT_TABLE[object]
      const cols = object === 'schedule' ? 'id' : 'id,name,status,deleted_at'
      const { data } = await supabase.from(table).select(cols).in('id', [...ids])
      for (const row of (data ?? []) as unknown as LiveRow[]) {
        if (soft && row.deleted_at) continue // 软删的算不存在
        live.set(`${object}:${row.id}`, row)
      }
    }),
  )
  return live
}

/** UUID 才可能是真实对象 id；失败记录会写 '-' 这种占位 */
const isId = (v: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/**
 * 把同一次需求产出的对象归到一起（WF-27）。
 *
 * 关联依据：同一操作人 + 同一原始需求描述 + 30 分钟内。
 * 🔴 没有用「时间接近」单条件——那会把两次无关的操作硬凑成一组；
 * 描述相同才是「同一件事」的可靠信号。老记录没写描述的，就只有自己这一个对象。
 */
const GROUP_WINDOW_MS = 30 * 60 * 1000

function groupKeyOf(a: AiActivity): string | null {
  if (!a.prompt || !a.actorId || !a.createdAt) return null
  return `${a.actorId}::${a.prompt}`
}

/**
 * 列出本租户的 AI 自动创建记录（RLS 兜底租户隔离）。
 *
 * onlyMine：普通成员只看自己的。看全租户需要 audit:read（Admin/Auditor），
 * 由调用方（API 层）判权后传入，数据层不自行决定权限。
 */
export async function listAiActivity(
  ctx: RequestContext,
  opts: { limit?: number; onlyMine?: boolean; object?: AiActivityObject } = {},
): Promise<AiActivity[]> {
  const supabase = await createClient()
  let query = supabase
    .from('audit_logs')
    .select('id,action,target_type,target_id,detail,created_at,actor_id,actor:users!actor_id(name)')
    .in('action', AI_ACTION_KEYS)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500))
  if (opts.onlyMine) query = query.eq('actor_id', ctx.userId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  const list = ((data ?? []) as unknown as Row[])
    .map(toActivity)
    .filter((x): x is AiActivity => x !== null)

  // ── 补齐每条记录的对象清单（WF-27）────────────────────────────────
  const wanted = new Map<AiActivityObject, Set<string>>()
  for (const a of list) {
    if (!isId(a.targetId)) continue
    if (!wanted.has(a.object)) wanted.set(a.object, new Set())
    wanted.get(a.object)!.add(a.targetId)
  }
  const live = await fetchLiveObjects(supabase, wanted)

  // 同一需求下的兄弟记录（用于把关联产物一并列出）
  const groups = new Map<string, AiActivity[]>()
  for (const a of list) {
    const k = groupKeyOf(a)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(a)
  }

  const toTarget = (a: AiActivity, primary: boolean): AiActivityTarget | null => {
    if (!isId(a.targetId)) return null
    const row = live.get(`${a.object}:${a.targetId}`)
    return {
      object: a.object,
      id: a.targetId,
      name: row?.name ?? a.name ?? '（未命名）',
      status: row?.status ?? null,
      exists: !!row,
      primary,
    }
  }

  for (const a of list) {
    const self = toTarget(a, true)
    const targets: AiActivityTarget[] = self ? [self] : []
    const k = groupKeyOf(a)
    if (k && a.createdAt) {
      const at = new Date(a.createdAt).getTime()
      for (const sib of groups.get(k) ?? []) {
        if (sib.id === a.id || !sib.success || !isId(sib.targetId)) continue
        if (Math.abs(new Date(sib.createdAt ?? 0).getTime() - at) > GROUP_WINDOW_MS) continue
        if (targets.some((t) => t.id === sib.targetId && t.object === sib.object)) continue
        const t = toTarget(sib, false)
        if (t) targets.push(t)
      }
    }
    a.targets = targets
  }

  return opts.object ? list.filter((x) => x.object === opts.object) : list
}
