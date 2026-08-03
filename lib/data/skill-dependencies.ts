import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// V12-3.2 / V12-3.3 / ADR-018 §3：Skill 的依赖关系数据层。
//
// 依赖粒度是 **Plugin 对象**（Tool / Provider 能力 / Connector 能力），不是仅 Tool
// ——D-04 在 v1.13 已修正（v1.12 原文写「任意 Tool 对象」是笔误）。

export type DepObjectType = 'tool' | 'provider' | 'connector'
export const DEP_OBJECT_TYPES: readonly DepObjectType[] = ['tool', 'provider', 'connector'] as const

export type SkillPluginDep = {
  id: string
  skillId: string
  objectType: DepObjectType
  objectId: string
  objectVersion: string | null
  required: boolean
}

export type SkillKbDep = {
  id: string
  skillId: string
  knowledgeBaseId: string
  required: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 入参校验失败 → 路由回 400/422，而非 500。 */
export class SkillDepError extends Error {
  constructor(message: string) { super(message); this.name = 'SkillDepError' }
}

/**
 * 🔴 D-05 的服务端防线：Skill 禁止依赖 Workflow。
 *
 * 这是三道防线的第二道（DB 的 CHECK 是第一道、最硬；前端选择器是第三道）。
 * 为什么服务端还要拦一遍：DB 那道只在真正写入时才生效，而我们要在**保存前**
 * 就给出人话提示，否则用户看到的是一串 PG 约束错误。
 *
 * 错误信息说清后果而非只说「不允许」——不然下一个人会当成随意限制去想办法绕。
 */
export function assertDepObjectType(v: unknown): DepObjectType {
  if (typeof v === 'string' && v.toLowerCase() === 'workflow') {
    throw new SkillDepError(
      'Skill 不能依赖 Workflow（D-05）：Skill 是「怎么做这件事」的方法，Workflow 是' +
      '「多步怎么编排」的流程，二者职责不同；且 Workflow 的多步/长时/可暂停语义' +
      '无法作为 Skill 的原子依赖。若要在流程中使用该 Skill，请在 Workflow 里引用它。',
    )
  }
  if (typeof v !== 'string' || !DEP_OBJECT_TYPES.includes(v as DepObjectType)) {
    throw new SkillDepError(`依赖对象类型无效（只能是 ${DEP_OBJECT_TYPES.join(' / ')}）`)
  }
  return v as DepObjectType
}

// ── 读 ──────────────────────────────────────────────────────────────────

export async function listSkillPluginDeps(ctx: RequestContext, skillId: string): Promise<SkillPluginDep[]> {
  if (!UUID_RE.test(skillId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skill_plugin_dependencies')
    .select('id,skill_id,object_type,object_id,object_version,required')
    .eq('skill_id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null)
    .order('created_at')
  if (error) throw new Error(error.message)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    skillId: r.skill_id as string,
    objectType: r.object_type as DepObjectType,
    objectId: r.object_id as string,
    objectVersion: (r.object_version as string | null) ?? null,
    required: !!r.required,
  }))
}

export async function listSkillKbDeps(ctx: RequestContext, skillId: string): Promise<SkillKbDep[]> {
  if (!UUID_RE.test(skillId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skill_kb_dependencies')
    .select('id,skill_id,knowledge_base_id,required')
    .eq('skill_id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null)
    .order('created_at')
  if (error) throw new Error(error.message)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: r.id as string,
    skillId: r.skill_id as string,
    knowledgeBaseId: r.knowledge_base_id as string,
    required: !!r.required,
  }))
}

// ── 写（覆盖式）────────────────────────────────────────────────────────

/**
 * 覆盖式设置 Skill 的 Plugin 对象依赖：软删旧的 + 插新的。
 *
 * 用覆盖而非增量：前端编辑页是「勾选一组」的交互，增量接口会让「取消勾选」
 * 变成额外一次删除调用，两次调用之间失败就留下不一致状态。
 */
export async function setSkillPluginDeps(
  ctx: RequestContext,
  skillId: string,
  deps: { objectType: unknown; objectId: string; objectVersion?: string | null; required?: boolean }[],
): Promise<SkillPluginDep[]> {
  if (!UUID_RE.test(skillId)) throw new SkillDepError('Skill 无效')

  // 先全量校验再落库——一条不合法就整批拒绝，不做「部分成功」
  const normalized = deps.map((d) => {
    const objectType = assertDepObjectType(d.objectType)
    if (!UUID_RE.test(d.objectId)) throw new SkillDepError('依赖对象 ID 无效')
    return {
      object_type: objectType,
      object_id: d.objectId,
      object_version: d.objectVersion ?? null,
      required: d.required ?? true,
    }
  })

  const supabase = await createClient()
  // 目标 Skill 必须属本租户——否则等于往别家的 Skill 上挂依赖
  const { data: skill } = await supabase.from('skills').select('id')
    .eq('id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!skill) throw new SkillDepError('Skill 不存在或无权访问')

  const now = new Date().toISOString()
  const { error: delErr } = await supabase.from('skill_plugin_dependencies')
    .update({ deleted_at: now, updated_at: now })
    .eq('skill_id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)

  if (normalized.length > 0) {
    const { error } = await supabase.from('skill_plugin_dependencies').insert(
      normalized.map((n) => ({ ...n, org_id: ctx.orgId, skill_id: skillId, created_by: ctx.userId })),
    )
    if (error) throw new Error(error.message)
  }
  return listSkillPluginDeps(ctx, skillId)
}

export async function setSkillKbDeps(
  ctx: RequestContext,
  skillId: string,
  kbIds: string[],
): Promise<SkillKbDep[]> {
  if (!UUID_RE.test(skillId)) throw new SkillDepError('Skill 无效')
  const ids = [...new Set(kbIds.filter((x) => UUID_RE.test(x)))]

  const supabase = await createClient()
  const { data: skill } = await supabase.from('skills').select('id')
    .eq('id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!skill) throw new SkillDepError('Skill 不存在或无权访问')

  const now = new Date().toISOString()
  await supabase.from('skill_kb_dependencies')
    .update({ deleted_at: now, updated_at: now })
    .eq('skill_id', skillId).eq('org_id', ctx.orgId).is('deleted_at', null)

  if (ids.length > 0) {
    const { error } = await supabase.from('skill_kb_dependencies').insert(
      ids.map((id) => ({ org_id: ctx.orgId, skill_id: skillId, knowledge_base_id: id, created_by: ctx.userId })),
    )
    if (error) throw new Error(error.message)
  }
  return listSkillKbDeps(ctx, skillId)
}

// ── 发布前校验（D-05 + D-19）──────────────────────────────────────────

export type PublishCheckResult = {
  ok: boolean
  problems: { code: string; message: string }[]
}

/**
 * Skill 发布前的依赖检查。
 *
 * 两条硬规则：
 *   ① 🔴 依赖图中不得出现 Workflow —— **直接与间接均禁**（D-05）。
 *      间接指：Skill → Tool → 某个把 Workflow 包起来的 Binding。
 *      Tool 的 binding_type 已在 DB 层排除 workflow（0029），所以这里只需
 *      确认所依赖的 Tool 确实存在且 binding 合法，不必再遍历一层。
 *   ② 依赖必须锁版本（D-19）—— 否则下层升版会让已发布的 Skill 行为突变。
 */
export async function checkSkillPublishable(ctx: RequestContext, skillId: string): Promise<PublishCheckResult> {
  const problems: PublishCheckResult['problems'] = []
  const deps = await listSkillPluginDeps(ctx, skillId)

  const unlocked = deps.filter((d) => !d.objectVersion)
  if (unlocked.length > 0) {
    problems.push({
      code: 'unlocked_version',
      message: `有 ${unlocked.length} 个依赖未锁定版本。发布必须锁版本，否则下层升级会让本 Skill 的行为在无人改动的情况下改变。`,
    })
  }

  const toolIds = deps.filter((d) => d.objectType === 'tool').map((d) => d.objectId)
  if (toolIds.length > 0) {
    const supabase = await createClient()
    const { data } = await supabase.from('tools')
      .select('id,name,binding_type,status')
      .in('id', toolIds).eq('org_id', ctx.orgId).is('deleted_at', null)
    const found = (data as { id: string; name: string; binding_type: string; status: string }[] | null) ?? []
    const foundIds = new Set(found.map((t) => t.id))

    const missing = toolIds.filter((id) => !foundIds.has(id))
    if (missing.length > 0) {
      problems.push({ code: 'dep_missing', message: `有 ${missing.length} 个依赖的 Tool 已不存在或无权访问` })
    }
    // AC-17：依赖了未发布/已下线的 Tool，发布后运行必然失败，不如发布时就拦住
    const notUsable = found.filter((t) => t.status !== 'published')
    if (notUsable.length > 0) {
      problems.push({
        code: 'dep_not_published',
        message: `依赖的 Tool 未处于已发布状态：${notUsable.map((t) => t.name).join('、')}`,
      })
    }
    // 兜底：DB 已排除 workflow binding，此处再确认一次，防将来放宽枚举时静默失守
    const illegal = found.filter((t) => t.binding_type === 'workflow')
    if (illegal.length > 0) {
      problems.push({
        code: 'workflow_dependency',
        message: `依赖链中出现 Workflow（D-05 禁止）：${illegal.map((t) => t.name).join('、')}`,
      })
    }
  }

  return { ok: problems.length === 0, problems }
}

/**
 * AC-17 反查：某个 Plugin 对象被哪些 Skill 依赖。
 * 下线 Tool 前调用，让用户知道会影响谁——而不是下线完才发现线上一片报错。
 */
export async function listSkillsDependingOn(
  ctx: RequestContext,
  objectType: DepObjectType,
  objectId: string,
): Promise<{ skillId: string; skillName: string; skillStatus: string }[]> {
  if (!UUID_RE.test(objectId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skill_plugin_dependencies')
    .select('skill_id, skills(id,name,status)')
    .eq('object_type', objectType).eq('object_id', objectId)
    .eq('org_id', ctx.orgId).is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data as unknown as { skill_id: string; skills: { id: string; name: string; status: string } | null }[] | null) ?? []
  return rows
    .filter((r) => r.skills)
    .map((r) => ({ skillId: r.skills!.id, skillName: r.skills!.name, skillStatus: r.skills!.status }))
}

/**
 * 🔴 V12-3.6 / AC-17：运行前检查 —— Skill 的依赖是否都还可用。
 *
 * 「下线」不能只是列表里看不见，必须**真正阻断新运行**。
 * 一个被下线的 Tool 若仍能被已发布的 Skill 调用，下线就等于没做。
 *
 * 只拦 required 依赖：可选依赖缺失时降级运行（少点能力总比整个 Skill 跑不起来好）。
 */
export type RunnableCheck = {
  runnable: boolean
  blockedBy: { objectType: DepObjectType; objectId: string; name: string; reason: string }[]
}

export async function checkSkillRunnable(ctx: RequestContext, skillId: string): Promise<RunnableCheck> {
  const deps = await listSkillPluginDeps(ctx, skillId)
  const requiredTools = deps.filter((d) => d.objectType === 'tool' && d.required)
  if (requiredTools.length === 0) return { runnable: true, blockedBy: [] }

  const supabase = await createClient()
  const { data } = await supabase.from('tools')
    .select('id,name,status')
    .in('id', requiredTools.map((d) => d.objectId))
    .eq('org_id', ctx.orgId).is('deleted_at', null)
  const found = (data as { id: string; name: string; status: string }[] | null) ?? []
  const byId = new Map(found.map((t) => [t.id, t]))

  const blockedBy: RunnableCheck['blockedBy'] = []
  for (const d of requiredTools) {
    const tool = byId.get(d.objectId)
    if (!tool) {
      blockedBy.push({
        objectType: 'tool', objectId: d.objectId, name: '(已删除)',
        reason: '依赖的 Tool 已不存在',
      })
    } else if (tool.status !== 'published') {
      blockedBy.push({
        objectType: 'tool', objectId: d.objectId, name: tool.name,
        reason: tool.status === 'offline' ? '依赖的 Tool 已下线' : `依赖的 Tool 尚未发布（当前 ${tool.status}）`,
      })
    }
  }
  return { runnable: blockedBy.length === 0, blockedBy }
}
