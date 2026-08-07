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
  }
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
  return opts.object ? list.filter((x) => x.object === opts.object) : list
}
