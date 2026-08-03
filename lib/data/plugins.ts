import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { PLUGIN_TRANSITIONS, type PluginTransitionAction, type PluginStatus } from '@/lib/plugins/status'

// V12-2.4 / ADR-018：Plugin 数据层（ADR-008 四层依赖，请求级客户端，RLS 生效）。
//
// Plugin = 能力交付与 Provider 治理单元，是「包」；Tool 是包里的「原子操作」。
// 一个 Plugin 可提供多个 Tool（AC-02）。

export type ProviderType = 'mcp' | 'api' | 'db' | 'smtp'
// smtp 由迁移 0037 加入枚举（V12-4.9）
export const PROVIDER_TYPES: readonly ProviderType[] = ['mcp', 'api', 'db', 'smtp'] as const

export type Plugin = {
  id: string
  name: string
  description: string
  providerType: ProviderType
  repo: string | null
  license: string | null
  docsUrl: string | null
  stars: number | null
  status: PluginStatus
  origin: 'user' | 'platform'
  mandatory: boolean
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id,name,description,provider_type,repo,license,docs_url,stars,status,origin,mandatory,created_at'

type Row = {
  id: string; name: string; description: string | null; provider_type: string
  repo: string | null; license: string | null; docs_url: string | null; stars: number | null
  status: string; origin: string; mandatory: boolean; created_at: string | null
}

function mapRow(r: Row): Plugin {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    providerType: r.provider_type as ProviderType,
    repo: r.repo,
    license: r.license,
    docsUrl: r.docs_url,
    stars: r.stars,
    status: r.status as PluginStatus,
    origin: r.origin === 'platform' ? 'platform' : 'user',
    mandatory: !!r.mandatory,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

/** 入参校验失败 → 路由回 400，而非 500。 */
export class PluginValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PluginValidationError' }
}

export const PLUGIN_NAME_MAX = 100

export function assertPluginName(name: string): string {
  const t = (name ?? '').trim()
  if (!t) throw new PluginValidationError('名称不能为空')
  if (t.length > PLUGIN_NAME_MAX) throw new PluginValidationError(`名称过长（最多 ${PLUGIN_NAME_MAX} 字）`)
  return t
}

/**
 * 🔴 provider_type 只认 mcp/api/db。
 * **故意不含 workflow**（D-06）：Workflow 不是 Provider 类型，也不得成为 Tool Binding——
 * 一旦放开，Skill 就能经 Tool 间接调用 Workflow，绕过 D-05 的禁令。
 * DB 层 CHECK 已堵死，这里是第二道（服务端校验），前端选择器是第三道。
 */
export function assertProviderType(v: unknown): ProviderType {
  if (typeof v !== 'string' || !PROVIDER_TYPES.includes(v as ProviderType)) {
    throw new PluginValidationError(`供应商类型无效（只能是 ${PROVIDER_TYPES.join(' / ')}）`)
  }
  return v as ProviderType
}

export async function listPlugins(
  ctx: RequestContext,
  filter?: { providerType?: ProviderType; status?: PluginStatus },
): Promise<Plugin[]> {
  const supabase = await createClient()
  let q = supabase.from('plugins').select(COLS)
    .eq('org_id', ctx.orgId)        // RLS + 显式 org_id 双层隔离（CLAUDE.md 铁律）
    .is('deleted_at', null)
  if (filter?.providerType) q = q.eq('provider_type', filter.providerType)
  if (filter?.status) q = q.eq('status', filter.status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(mapRow)
}

export async function getPluginById(ctx: RequestContext, id: string): Promise<Plugin | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('plugins').select(COLS)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function createPlugin(
  ctx: RequestContext,
  input: {
    name: string; description?: string; providerType: unknown
    repo?: string | null; license?: string | null; docsUrl?: string | null; stars?: number | null
  },
): Promise<Plugin> {
  const name = assertPluginName(input.name)
  const providerType = assertProviderType(input.providerType)

  const supabase = await createClient()
  const { data, error } = await supabase.from('plugins').insert({
    org_id: ctx.orgId,
    created_by: ctx.userId,
    name,
    description: input.description ?? null,
    provider_type: providerType,
    repo: input.repo ?? null,
    license: input.license ?? null,
    docs_url: input.docsUrl ?? null,
    stars: typeof input.stars === 'number' ? input.stars : null,
    status: 'draft',              // 一律 draft，发布须走状态机
    origin: 'user',
    mandatory: false,
  }).select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new PluginValidationError('同名 Plugin 已存在')
    throw new Error(error.message)
  }
  return mapRow(data as Row)
}

export async function updatePlugin(
  ctx: RequestContext,
  id: string,
  patch: { name?: string; description?: string; repo?: string | null; license?: string | null; docsUrl?: string | null },
): Promise<Plugin | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = assertPluginName(patch.name)
  if (typeof patch.description === 'string') fields.description = patch.description
  if (patch.repo !== undefined) fields.repo = patch.repo
  if (patch.license !== undefined) fields.license = patch.license
  if (patch.docsUrl !== undefined) fields.docs_url = patch.docsUrl
  // provider_type 刻意不可改：改了等于换一个 Plugin，其下所有 Tool 的 Binding 都会失配
  if (Object.keys(fields).length === 0) return getPluginById(ctx, id)
  fields.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { data, error } = await supabase.from('plugins').update(fields)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .select(COLS).maybeSingle()
  if (error) {
    if (error.code === '23505') throw new PluginValidationError('同名 Plugin 已存在')
    throw new Error(error.message)
  }
  return data ? mapRow(data as Row) : null
}

/** 删除结果：区分「不存在」「已发布须先下线」「仍有 Tool 依赖」，路由据此给 404 / 409。 */
export type DeletePluginResult = 'deleted' | 'not_found' | 'published' | 'has_tools'

export async function deletePlugin(ctx: RequestContext, id: string): Promise<DeletePluginResult> {
  if (!UUID_RE.test(id)) return 'not_found'
  const supabase = await createClient()

  // 🔴 先看有没有在册 Tool：Plugin 被删而 Tool 还在，那些 Tool 的 plugin_id 就成了悬空引用，
  // 而它们可能正被已发布的 Skill 依赖着。宁可让用户先处理 Tool。
  const { data: tools } = await supabase.from('tools').select('id')
    .eq('plugin_id', id).eq('org_id', ctx.orgId).is('deleted_at', null).limit(1)
  if ((tools ?? []).length > 0) return 'has_tools'

  const now = new Date().toISOString()
  // 拦截条件写进 update 本身，不先查后写——避免「查到是 offline → 期间被上线 → 仍删掉」的并发窗口
  const { data, error } = await supabase.from('plugins')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .neq('status', 'published')
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return 'deleted'

  const { data: exist } = await supabase.from('plugins').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  return (exist as { status?: string } | null)?.status === 'published' ? 'published' : 'not_found'
}

export type PluginTransitionResult =
  | { ok: true; status: PluginStatus }
  | { ok: false; reason: 'not_found' | 'illegal' }

export async function transitionPlugin(
  ctx: RequestContext,
  id: string,
  action: PluginTransitionAction,
): Promise<PluginTransitionResult> {
  const t = PLUGIN_TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }

  const supabase = await createClient()
  // 用 from 态作为 update 条件：当前态不符即 0 行 → 非法流转。单条语句关掉并发窗口。
  const { data, error } = await supabase.from('plugins')
    .update({ status: t.to, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .eq('status', t.from)
    .select('status').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, status: (data as { status: string }).status as PluginStatus }

  const { data: exist } = await supabase.from('plugins').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  return exist ? { ok: false, reason: 'illegal' } : { ok: false, reason: 'not_found' }
}
