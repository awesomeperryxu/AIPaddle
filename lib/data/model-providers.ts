import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptApiKey, decryptApiKey, maskApiKey, isEncryptionAvailable } from '@/lib/crypto/model-key'

// ADR-016 4.7.3：租户模型供应商数据层。
// 「两把钥匙」：Key 加密写、脱敏读；解密只经 getProviderApiKey（服务端，供连通性测试/4.7.2 解析用）。
// 前端一律拿脱敏视图（无密文/明文）。

// 支持的供应商类型（适配见 4.7.5）。custom = 自定义 OpenAI 兼容端点，覆盖长尾。
export const PROVIDER_TYPES = [
  'openai-compat', 'openai', 'anthropic', 'bedrock', 'gemini', 'custom',
] as const
export type ProviderType = (typeof PROVIDER_TYPES)[number]

export type ProviderMasked = {
  id: string
  provider: ProviderType
  credentialName: string
  baseUrl: string | null
  keyMasked: string        // 仅后 4 位
  models: string[]
  enabled: boolean
  createdAt: string
}

type Row = {
  id: string
  provider: string
  credential_name: string
  base_url: string | null
  api_key_ciphertext: string
  models: unknown
  enabled: boolean
  created_at: string | null
}

function toMasked(r: Row): ProviderMasked {
  let keyMasked = '****'
  try {
    keyMasked = maskApiKey(decryptApiKey(r.api_key_ciphertext))
  } catch { /* 密钥缺失/密文异常 → 保守显示 ****，不泄露 */ }
  return {
    id: r.id,
    provider: (r.provider as ProviderType),
    credentialName: r.credential_name,
    baseUrl: r.base_url,
    keyMasked,
    models: Array.isArray(r.models) ? (r.models as string[]) : [],
    enabled: r.enabled,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

const COLS = 'id,provider,credential_name,base_url,api_key_ciphertext,models,enabled,created_at'

/** 列出本租户供应商（脱敏）。RLS + 显式 org_id 双层隔离（CLAUDE.md 铁律）。 */
export async function listProviders(ctx: RequestContext): Promise<ProviderMasked[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_model_providers')
    .select(COLS)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toMasked)
}

/**
 * 4.8.10：**平台超管代某租户**读写模型供应商。
 *
 * 与上面的租户自管函数刻意分开命名，而不是给它们加个可选 orgId 参数——
 * 后者一旦某处漏传/误传就会静默跨租户操作，属于最危险的那类 bug。
 * 独立函数 + admin client 让「这是跨租户操作」在调用点一目了然，
 * 且入口必须由 isPlatformAdmin 兜住（此层不做 RLS 隔离，比照 lib/data/tenants.ts）。
 */
export async function listProvidersForOrg(orgId: string): Promise<ProviderMasked[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenant_model_providers')
    .select(COLS)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toMasked)
}

/** 4.8.10：平台超管为指定租户新增供应商（Key 加密规则与租户自管完全一致）。 */
export async function createProviderForOrg(
  orgId: string,
  actorId: string,
  input: CreateProviderInput,
): Promise<ProviderMasked> {
  if (!isEncryptionAvailable()) throw new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法保存模型 Key')
  if (!input.apiKey?.trim()) throw new Error('API Key 不能为空')
  if (!input.credentialName?.trim()) throw new Error('凭据名称不能为空')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenant_model_providers')
    .insert({
      org_id: orgId,
      provider: input.provider,
      credential_name: input.credentialName.trim(),
      base_url: input.baseUrl?.trim() || null,
      api_key_ciphertext: encryptApiKey(input.apiKey.trim()),
      models: input.models ?? [],
      created_by: actorId,
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return toMasked(data as Row)
}

/** 4.8.10：平台超管软删指定租户的供应商。orgId 一并校验，避免只凭 id 误删他租户的。 */
export async function deleteProviderForOrg(orgId: string, id: string): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('tenant_model_providers')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id).eq('org_id', orgId).is('deleted_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  return ((data as { id: string }[] | null) ?? []).length > 0
}

export type CreateProviderInput = {
  provider: ProviderType
  credentialName: string
  baseUrl?: string | null
  apiKey: string
  models?: string[]
}

/** 新增供应商：加密 Key 后落库；主密钥缺失则拒绝（上层应先查 isEncryptionAvailable）。 */
export async function createProvider(ctx: RequestContext, input: CreateProviderInput): Promise<ProviderMasked> {
  if (!isEncryptionAvailable()) throw new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法保存模型 Key')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_model_providers')
    .insert({
      org_id: ctx.orgId,
      provider: input.provider,
      credential_name: input.credentialName,
      base_url: input.baseUrl ?? null,
      api_key_ciphertext: encryptApiKey(input.apiKey),
      models: input.models ?? [],
      created_by: ctx.userId,
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return toMasked(data as Row)
}

export type UpdateProviderInput = {
  credentialName?: string
  baseUrl?: string | null
  apiKey?: string        // 传入才重新加密覆盖；不传保留原 Key
  models?: string[]
  enabled?: boolean
}

/** 更新供应商；apiKey 传入才重新加密覆盖。 */
export async function updateProvider(_ctx: RequestContext, id: string, input: UpdateProviderInput): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.credentialName !== undefined) patch.credential_name = input.credentialName
  if (input.baseUrl !== undefined) patch.base_url = input.baseUrl
  if (input.models !== undefined) patch.models = input.models
  if (input.enabled !== undefined) patch.enabled = input.enabled
  if (input.apiKey !== undefined && input.apiKey !== '') {
    if (!isEncryptionAvailable()) throw new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法更新模型 Key')
    patch.api_key_ciphertext = encryptApiKey(input.apiKey)
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenant_model_providers')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/** 软删除供应商。 */
export async function deleteProvider(_ctx: RequestContext, id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenant_model_providers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/** 解密取某供应商明文 Key（服务端 only：连通性测试 / 4.7.2 解析用）。找不到/无权返回 null。 */
export async function getProviderApiKey(
  _ctx: RequestContext,
  id: string,
): Promise<{ provider: ProviderType; baseUrl: string | null; apiKey: string } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_model_providers')
    .select('provider,base_url,api_key_ciphertext')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as { provider: string; base_url: string | null; api_key_ciphertext: string }
  return { provider: r.provider as ProviderType, baseUrl: r.base_url, apiKey: decryptApiKey(r.api_key_ciphertext) }
}

// ── 租户默认模型槽（tenants.model_settings）─────────────────
export type ModelSlot = { providerId: string; model: string }
export type ModelSettings = Partial<Record<'llm' | 'embedding' | 'rerank' | 'stt' | 'tts', ModelSlot>>

export async function getModelSettings(_ctx: RequestContext): Promise<ModelSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('model_settings')
    .eq('id', _ctx.orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return ((data as { model_settings?: ModelSettings } | null)?.model_settings) ?? {}
}

export async function setModelSettings(_ctx: RequestContext, settings: ModelSettings): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ model_settings: settings, updated_at: new Date().toISOString() })
    .eq('id', _ctx.orgId)
  if (error) throw new Error(error.message)
}
