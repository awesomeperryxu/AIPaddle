import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { encryptApiKey, decryptApiKey, maskApiKey, isEncryptionAvailable } from '@/lib/crypto/model-key'
import { PluginValidationError } from '@/lib/data/plugins'

// V12-2.6 / ADR-018 §8：租户加密凭证数据层（Plugin / Tool / DataSource 共用）。
//
// 🔴 铁律（AC-15，与成员密码同档）：
//   · 明文只在**写入时**接收、在**运行时解密使用**，其余任何时候不得出现；
//   · 读接口一律返回脱敏值，绝不返回明文或密文；
//   · 未配 MODEL_KEY_ENC_SECRET 时**拒绝保存**，不静默降级存明文；
//   · 明文绝不进审计 detail、日志、响应体。
//
// 与 tenant_model_providers 的分工：那张表专用于模型供应商（provider + base_url + models），
// 本表面向 Plugin/Tool/DataSource 的通用凭证。两者共用同一套 AES-256-GCM 实现。

export type CredentialKind = 'oauth' | 'api_key' | 'jwt' | 'db_secret' | 'smtp'
export const CREDENTIAL_KINDS: readonly CredentialKind[] =
  ['oauth', 'api_key', 'jwt', 'db_secret', 'smtp'] as const

/** 对外形状：**没有** secret 字段，从类型层面杜绝误返回明文。 */
export type CredentialMasked = {
  id: string
  name: string
  description: string
  kind: CredentialKind
  /** 脱敏展示值，如 sk-****alue；仅供界面识别，不可用于调用 */
  secretMasked: string
  /** 非敏感辅助字段（OAuth client_id、DB host/port 等） */
  meta: Record<string, unknown>
  expiresAt: string | null
  enabled: boolean
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id,name,description,kind,secret_ciphertext,meta,expires_at,enabled,created_at'

type Row = {
  id: string; name: string; description: string | null; kind: string
  secret_ciphertext: string; meta: unknown
  expires_at: string | null; enabled: boolean; created_at: string | null
}

/**
 * 行 → 脱敏形状。
 * 🔴 这是唯一的出口——所有读路径都必须经过它，绝不允许直接把 Row 交给调用方。
 * 脱敏值由密文解密后再遮罩得到；解密失败时给固定占位，不暴露"解不开"这一事实的细节。
 */
function toMasked(r: Row): CredentialMasked {
  let masked = '****'
  try {
    masked = maskApiKey(decryptApiKey(r.secret_ciphertext))
  } catch {
    // 主密钥轮换过、或密文损坏。不抛错——否则整个列表页 500，
    // 用户连"哪条坏了"都看不到，无从修复。
    masked = '**** (无法解密)'
  }
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    kind: r.kind as CredentialKind,
    secretMasked: masked,
    meta: (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>,
    expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : null,
    enabled: !!r.enabled,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

export function assertKind(v: unknown): CredentialKind {
  if (typeof v !== 'string' || !CREDENTIAL_KINDS.includes(v as CredentialKind)) {
    throw new PluginValidationError(`凭证类型无效（只能是 ${CREDENTIAL_KINDS.join(' / ')}）`)
  }
  return v as CredentialKind
}

/**
 * meta 只放非敏感字段。
 * 这里做一次**兜底拦截**：常见的敏感键名混进 meta 就直接拒绝——
 * 光靠注释提醒"口令请放 secret"，迟早有人放错，而放错了就是明文落库。
 */
const SENSITIVE_META_KEYS = /^(password|passwd|pwd|secret|token|api_?key|private_?key|client_?secret|credential)$/i

export function assertMeta(v: unknown): Record<string, unknown> {
  if (v === undefined || v === null) return {}
  if (typeof v !== 'object' || Array.isArray(v)) throw new PluginValidationError('meta 必须是对象')
  const obj = v as Record<string, unknown>
  for (const k of Object.keys(obj)) {
    if (SENSITIVE_META_KEYS.test(k)) {
      throw new PluginValidationError(
        `meta 中不得包含敏感字段「${k}」——它会以明文落库。口令/私钥/token 请放 secret 字段（会加密）`,
      )
    }
  }
  return obj
}

export async function listCredentials(ctx: RequestContext, kind?: CredentialKind): Promise<CredentialMasked[]> {
  const supabase = await createClient()
  let q = supabase.from('credentials').select(COLS)
    .eq('org_id', ctx.orgId).is('deleted_at', null)
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toMasked)
}

export async function getCredentialById(ctx: RequestContext, id: string): Promise<CredentialMasked | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('credentials').select(COLS)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toMasked(data as Row) : null
}

export async function createCredential(
  ctx: RequestContext,
  input: { name: string; description?: string; kind: unknown; secret: string; meta?: unknown; expiresAt?: string | null },
): Promise<CredentialMasked> {
  const name = (input.name ?? '').trim()
  if (!name) throw new PluginValidationError('凭证名称不能为空')
  const kind = assertKind(input.kind)
  const meta = assertMeta(input.meta)
  if (typeof input.secret !== 'string' || !input.secret.trim()) {
    throw new PluginValidationError('凭证内容不能为空')
  }
  // 🔴 未配主密钥即拒绝，绝不降级存明文
  if (!isEncryptionAvailable()) {
    throw new PluginValidationError('未配置 MODEL_KEY_ENC_SECRET，暂无法保存凭证')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('credentials').insert({
    org_id: ctx.orgId,
    created_by: ctx.userId,
    name,
    description: input.description ?? null,
    kind,
    secret_ciphertext: encryptApiKey(input.secret),
    meta,
    expires_at: input.expiresAt ?? null,
    enabled: true,
  }).select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new PluginValidationError('同名凭证已存在')
    throw new Error(error.message)
  }
  return toMasked(data as Row)
}

export async function updateCredential(
  ctx: RequestContext,
  id: string,
  patch: { name?: string; description?: string; secret?: string; meta?: unknown; expiresAt?: string | null; enabled?: boolean },
): Promise<CredentialMasked | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') {
    const n = patch.name.trim()
    if (!n) throw new PluginValidationError('凭证名称不能为空')
    fields.name = n
  }
  if (typeof patch.description === 'string') fields.description = patch.description
  if (patch.meta !== undefined) fields.meta = assertMeta(patch.meta)
  if (patch.expiresAt !== undefined) fields.expires_at = patch.expiresAt
  if (typeof patch.enabled === 'boolean') fields.enabled = patch.enabled
  // 换密：只在显式传了非空 secret 时才改，避免前端回填空串把凭证清掉
  if (typeof patch.secret === 'string' && patch.secret.trim()) {
    if (!isEncryptionAvailable()) {
      throw new PluginValidationError('未配置 MODEL_KEY_ENC_SECRET，暂无法保存凭证')
    }
    fields.secret_ciphertext = encryptApiKey(patch.secret)
  }
  // kind 刻意不可改：换类型等于换一个凭证，其形状与使用方式都不同
  if (Object.keys(fields).length === 0) return getCredentialById(ctx, id)
  fields.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { data, error } = await supabase.from('credentials').update(fields)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .select(COLS).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toMasked(data as Row) : null
}

/** 删除结果：被 Tool 版本引用时不得删（DB 侧 on delete restrict，这里给人话）。 */
export type DeleteCredentialResult = 'deleted' | 'not_found' | 'in_use'

export async function deleteCredential(ctx: RequestContext, id: string): Promise<DeleteCredentialResult> {
  if (!UUID_RE.test(id)) return 'not_found'
  const supabase = await createClient()

  // 被引用即拒绝：删掉会让线上 Tool 静默失效，而失效原因（凭证没了）在调用链里看不出来
  const { data: used } = await supabase.from('tool_versions').select('id')
    .eq('credential_id', id).is('deleted_at', null).limit(1)
  if ((used ?? []).length > 0) return 'in_use'

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('credentials')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  return data ? 'deleted' : 'not_found'
}

/**
 * 取明文供**运行时调用外部系统**使用。
 *
 * 🔴 唯一允许拿到明文的出口。调用方必须：
 *   · 只在实际发起调用的那一刻取；
 *   · 用完即弃，不缓存、不写日志、不放进任何响应；
 *   · 绝不经由 API 路由把结果透出给前端。
 * 命名刻意带 Plaintext，让 code review 时一眼看见。
 */
export async function getCredentialPlaintext(ctx: RequestContext, id: string): Promise<string | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('credentials')
    .select('secret_ciphertext,enabled,expires_at')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as { secret_ciphertext: string; enabled: boolean; expires_at: string | null }
  if (!row.enabled) return null
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null
  try {
    return decryptApiKey(row.secret_ciphertext)
  } catch {
    return null   // 解不开就当没有，不把异常细节抛给调用链
  }
}
