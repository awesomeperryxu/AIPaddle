import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TOOL_TRANSITIONS, type PluginTransitionAction, type PluginStatus } from '@/lib/plugins/status'
import { PluginValidationError } from '@/lib/data/plugins'

// V12-2.5 / ADR-018 / PRD v1.13 §7.2-7.3：Tool 数据层。
//
// Tool = 有明确输入输出 Schema、可被结构化调用的原子操作，由 Plugin 提供。

export type BindingType = 'mcp' | 'api' | 'db' | 'native' | 'smtp'
export const BINDING_TYPES: readonly BindingType[] = ['mcp', 'api', 'db', 'native', 'smtp'] as const

export type RiskLevel = 'low' | 'medium' | 'high'
export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'] as const

export type Tool = {
  id: string
  pluginId: string
  name: string
  displayName: string
  description: string
  bindingType: BindingType
  riskLevel: RiskLevel
  status: PluginStatus
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id,plugin_id,name,display_name,description,binding_type,risk_level,status,created_at'

type Row = {
  id: string; plugin_id: string; name: string; display_name: string | null
  description: string | null; binding_type: string; risk_level: string
  status: string; created_at: string | null
}

function mapRow(r: Row): Tool {
  return {
    id: r.id,
    pluginId: r.plugin_id,
    name: r.name,
    displayName: r.display_name ?? r.name,
    description: r.description ?? '',
    bindingType: r.binding_type as BindingType,
    riskLevel: (r.risk_level as RiskLevel) ?? 'low',
    status: r.status as PluginStatus,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

/**
 * 🔴 D-06 / AC-05：Workflow **绝不能**成为 Tool Binding。
 *
 * 理由不只是"规定"：
 *   ① Workflow 的多步、长时、可暂停语义装不进 Tool 的单次调用模型；
 *   ② 一旦允许，Skill 就能经 Tool 间接调用 Workflow，把 D-05 的禁令绕过去。
 *
 * 三道防线，缺一不可：DB 的 CHECK 约束（最硬）→ 本函数（服务端）→ 前端选择器。
 * 只靠前端不给选项是不算数的（CLAUDE.md 铁律）。
 */
export function assertBindingType(v: unknown): BindingType {
  if (typeof v === 'string' && v.toLowerCase() === 'workflow') {
    throw new PluginValidationError(
      'Workflow 不能注册为 Tool（D-06）：其多步/长时语义装不进单次调用模型，' +
      '且会让 Skill 经 Tool 间接调用 Workflow，绕过 D-05 的禁令',
    )
  }
  if (typeof v !== 'string' || !BINDING_TYPES.includes(v as BindingType)) {
    throw new PluginValidationError(`Binding 类型无效（只能是 ${BINDING_TYPES.join(' / ')}）`)
  }
  return v as BindingType
}

export function assertRiskLevel(v: unknown): RiskLevel {
  if (v === undefined || v === null) return 'low'
  if (typeof v !== 'string' || !RISK_LEVELS.includes(v as RiskLevel)) {
    throw new PluginValidationError(`风险等级无效（只能是 ${RISK_LEVELS.join(' / ')}）`)
  }
  return v as RiskLevel
}

export async function listTools(
  ctx: RequestContext,
  filter?: { pluginId?: string; status?: PluginStatus; bindingType?: BindingType },
): Promise<Tool[]> {
  const supabase = await createClient()
  let q = supabase.from('tools').select(COLS)
    .eq('org_id', ctx.orgId).is('deleted_at', null)
  if (filter?.pluginId) q = q.eq('plugin_id', filter.pluginId)
  if (filter?.status) q = q.eq('status', filter.status)
  if (filter?.bindingType) q = q.eq('binding_type', filter.bindingType)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(mapRow)
}

export async function getToolById(ctx: RequestContext, id: string): Promise<Tool | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('tools').select(COLS)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function createTool(
  ctx: RequestContext,
  input: {
    pluginId: string; name: string; displayName?: string; description?: string
    bindingType: unknown; riskLevel?: unknown
  },
): Promise<Tool> {
  const name = (input.name ?? '').trim()
  if (!name) throw new PluginValidationError('Tool 名称不能为空')
  if (!UUID_RE.test(input.pluginId)) throw new PluginValidationError('所属 Plugin 无效')
  const bindingType = assertBindingType(input.bindingType)
  const riskLevel = assertRiskLevel(input.riskLevel)

  const supabase = await createClient()
  // 所属 Plugin 必须存在且属本租户——否则等于往别家的 Plugin 里塞 Tool
  const { data: plugin } = await supabase.from('plugins').select('id')
    .eq('id', input.pluginId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!plugin) throw new PluginValidationError('所属 Plugin 不存在或无权访问')

  const { data, error } = await supabase.from('tools').insert({
    org_id: ctx.orgId,
    created_by: ctx.userId,
    plugin_id: input.pluginId,
    name,
    display_name: input.displayName ?? null,
    description: input.description ?? null,
    binding_type: bindingType,
    risk_level: riskLevel,
    status: 'draft',
  }).select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new PluginValidationError('该 Plugin 下已有同名 Tool')
    throw new Error(error.message)
  }
  return mapRow(data as Row)
}

export async function updateTool(
  ctx: RequestContext,
  id: string,
  patch: { name?: string; displayName?: string; description?: string; riskLevel?: unknown },
): Promise<Tool | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') {
    const n = patch.name.trim()
    if (!n) throw new PluginValidationError('Tool 名称不能为空')
    fields.name = n
  }
  if (typeof patch.displayName === 'string') fields.display_name = patch.displayName
  if (typeof patch.description === 'string') fields.description = patch.description
  if (patch.riskLevel !== undefined) fields.risk_level = assertRiskLevel(patch.riskLevel)
  // binding_type 与 plugin_id 刻意不可改：改了等于换一个 Tool，
  // 而已发布的 Skill 可能正锁着它的某个版本
  if (Object.keys(fields).length === 0) return getToolById(ctx, id)
  fields.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { data, error } = await supabase.from('tools').update(fields)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .select(COLS).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export type DeleteToolResult = 'deleted' | 'not_found' | 'published'

export async function deleteTool(ctx: RequestContext, id: string): Promise<DeleteToolResult> {
  if (!UUID_RE.test(id)) return 'not_found'
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('tools')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .neq('status', 'published')
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return 'deleted'

  const { data: exist } = await supabase.from('tools').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  return (exist as { status?: string } | null)?.status === 'published' ? 'published' : 'not_found'
}

export type ToolTransitionResult =
  | { ok: true; status: PluginStatus }
  | { ok: false; reason: 'not_found' | 'illegal' }

export async function transitionTool(
  ctx: RequestContext,
  id: string,
  action: PluginTransitionAction,
): Promise<ToolTransitionResult> {
  const t = TOOL_TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('tools')
    .update({ status: t.to, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .eq('status', t.from)
    .select('status').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, status: (data as { status: string }).status as PluginStatus }

  const { data: exist } = await supabase.from('tools').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  return exist ? { ok: false, reason: 'illegal' } : { ok: false, reason: 'not_found' }
}
