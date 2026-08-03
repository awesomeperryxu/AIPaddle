import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { PluginValidationError } from '@/lib/data/plugins'
import type { BindingType } from '@/lib/data/tools'
import type { PluginStatus } from '@/lib/plugins/status'
import { assertApiBinding, assertDbBinding, BindingConfigError } from '@/lib/plugins/binding'

// V12-4.3 / V12-4.4：Tool 版本数据层。
//
// Binding 的具体配置存在版本上而非 Tool 上——Skill 依赖锁到 tool_version（D-19），
// Tool 升版（换 endpoint、改查询模板）不会影响已发布的 Skill。

export type ToolVersion = {
  id: string
  toolId: string
  version: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  bindingConfig: Record<string, unknown>
  credentialId: string | null
  changelog: string
  status: PluginStatus
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id,tool_id,version,input_schema,output_schema,binding_config,credential_id,changelog,status,created_at'

type Row = {
  id: string; tool_id: string; version: string
  input_schema: unknown; output_schema: unknown; binding_config: unknown
  credential_id: string | null; changelog: string | null; status: string; created_at: string | null
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

function mapRow(r: Row): ToolVersion {
  return {
    id: r.id,
    toolId: r.tool_id,
    version: r.version,
    inputSchema: obj(r.input_schema),
    outputSchema: obj(r.output_schema),
    bindingConfig: obj(r.binding_config),
    credentialId: r.credential_id,
    changelog: r.changelog ?? '',
    status: r.status as PluginStatus,
    createdAt: r.created_at ?? '',
  }
}

/**
 * 按 Binding 类型校验配置。
 *
 * 🔴 这是**服务端唯一的强制点**。页面上的表单校验只是提示——
 * 直接 POST /api/tools/:id/versions 就绕过了前端，所以每条安全约束
 * （https、域名白名单、select-only、行数上限）都必须在这里再判一次。
 */
export function assertBindingConfig(bindingType: BindingType, raw: unknown): Record<string, unknown> {
  switch (bindingType) {
    case 'api': return assertApiBinding(raw) as unknown as Record<string, unknown>
    case 'db': return assertDbBinding(raw) as unknown as Record<string, unknown>
    // mcp / native / smtp 的配置形状由各自任务定义（smtp 见 V12-4.9），
    // 这里原样透传但仍拦敏感键名——见下
    default: return obj(raw)
  }
}

/**
 * 🔴 binding_config 绝不允许内联凭证值（0029 表注释的硬约束）。
 * 凭证一律经 credential_id 引用 credentials 表。
 * 与 lib/data/plugins.ts 的 assertMeta 同一取向：拦键名，不看值。
 *
 * 🔴 必须查**原始输入**，不能查归一化之后的结果。
 * 真机验证时踩到过：assertDbBinding 返回的是只含已知键的新对象，
 * 传进来的 password 被静默丢掉，这个函数再查就什么也查不到——
 * 于是接口回 201，用户以为凭证配上了，其实凭空消失。
 * 静默丢弃比报错更糟：没人会去排查一个"成功"的请求。
 */
const SECRET_KEY_RE = /(password|passwd|secret|token|api[_-]?key|apikey|credential|private[_-]?key|access[_-]?key)/i

/** 引用凭证的正当写法，不算内联 */
const CREDENTIAL_REF_KEYS = new Set(['credential_id', 'credentialId'])

function assertNoInlineSecret(cfg: Record<string, unknown>, path = 'binding_config'): void {
  for (const [k, v] of Object.entries(cfg)) {
    if (CREDENTIAL_REF_KEYS.has(k)) continue
    if (SECRET_KEY_RE.test(k)) {
      throw new BindingConfigError(
        `${path}.${k} 疑似凭证字段——凭证必须经 credential_id 引用，不得写进 binding_config`,
      )
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      assertNoInlineSecret(v as Record<string, unknown>, `${path}.${k}`)
    }
  }
}

export async function listToolVersions(ctx: RequestContext, toolId: string): Promise<ToolVersion[]> {
  if (!UUID_RE.test(toolId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('tool_versions').select(COLS)
    .eq('tool_id', toolId).eq('org_id', ctx.orgId).is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Row))
}

export async function createToolVersion(
  ctx: RequestContext,
  input: {
    toolId: string; version: string; bindingConfig: unknown
    inputSchema?: unknown; outputSchema?: unknown
    credentialId?: string | null; changelog?: string
  },
): Promise<ToolVersion> {
  if (!UUID_RE.test(input.toolId)) throw new PluginValidationError('Tool 无效')
  const version = (input.version ?? '').trim()
  if (!version) throw new PluginValidationError('版本号不能为空')

  const supabase = await createClient()
  // 所属 Tool 必须存在且属本租户；同时取回 binding_type 决定用哪套校验
  const { data: tool } = await supabase.from('tools').select('id,binding_type')
    .eq('id', input.toolId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!tool) throw new PluginValidationError('所属 Tool 不存在或无权访问')

  // 顺序要紧：先查原始输入（归一化会丢掉未知键，含误传的凭证），再归一化
  assertNoInlineSecret(obj(input.bindingConfig))
  const bindingConfig = assertBindingConfig(tool.binding_type as BindingType, input.bindingConfig)

  if (input.credentialId != null && !UUID_RE.test(input.credentialId)) {
    throw new PluginValidationError('凭证无效')
  }

  const { data, error } = await supabase.from('tool_versions').insert({
    org_id: ctx.orgId,
    created_by: ctx.userId,
    tool_id: input.toolId,
    version,
    input_schema: obj(input.inputSchema),
    output_schema: obj(input.outputSchema),
    binding_config: bindingConfig,
    credential_id: input.credentialId ?? null,
    changelog: input.changelog ?? null,
    status: 'draft',
  }).select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new PluginValidationError('该 Tool 下已有同名版本')
    throw new Error(error.message)
  }
  return mapRow(data as Row)
}

export async function updateToolVersion(
  ctx: RequestContext,
  id: string,
  patch: { bindingConfig?: unknown; inputSchema?: unknown; outputSchema?: unknown; changelog?: string },
): Promise<ToolVersion | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data: cur } = await supabase.from('tool_versions')
    .select('id,status,tool_id,tools(binding_type)')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!cur) return null

  // 🔴 已发布的版本不可改配置。Skill 依赖锁到具体 version（D-19）——
  // 就地改 endpoint 或查询模板，等于把所有依赖它的 Skill 的行为悄悄换掉，
  // 而版本号还是老的，排查时根本看不出来。要改就发新版本。
  if (cur.status === 'published' && patch.bindingConfig !== undefined) {
    throw new PluginValidationError('已发布的版本不可修改 Binding 配置——请新建版本')
  }

  const fields: Record<string, unknown> = {}
  if (patch.bindingConfig !== undefined) {
    const bt = (cur as unknown as { tools?: { binding_type?: string } }).tools?.binding_type
    if (!bt) throw new PluginValidationError('无法确定 Binding 类型')
    assertNoInlineSecret(obj(patch.bindingConfig))
    const cfg = assertBindingConfig(bt as BindingType, patch.bindingConfig)
    fields.binding_config = cfg
  }
  if (patch.inputSchema !== undefined) fields.input_schema = obj(patch.inputSchema)
  if (patch.outputSchema !== undefined) fields.output_schema = obj(patch.outputSchema)
  if (patch.changelog !== undefined) fields.changelog = patch.changelog
  if (Object.keys(fields).length === 0) return listOne(ctx, id)

  fields.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('tool_versions').update(fields)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).select(COLS).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

async function listOne(ctx: RequestContext, id: string): Promise<ToolVersion | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('tool_versions').select(COLS)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  return data ? mapRow(data as Row) : null
}
