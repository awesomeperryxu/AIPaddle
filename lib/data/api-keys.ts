import 'server-only'
import { createHash, randomBytes } from 'crypto'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 4.8.6：对外 API Key 数据层。铁律——明文只在签发时一次性返回；落库只存 sha256 哈希 + 展示前缀。
export type ApiKeyScope = 'agent' | 'readonly' | 'full'
export const API_KEY_SCOPES: readonly ApiKeyScope[] = ['agent', 'readonly', 'full'] as const

export type ApiKeyMasked = {
  id: string
  name: string
  keyPrefix: string
  scope: ApiKeyScope
  status: 'active' | 'revoked'
  lastUsedAt: string | null
  createdAt: string
  /** 绑定的 Extension；null = 平台级通用 Key（平台管理 → Key 管理签发的那种） */
  extensionId: string | null
  scopes: string[]
  expiresAt: string | null
}

// ── 纯函数（可单测；randomBytes 可注入）────────────────────────
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/** 生成 Key：`ap_sk_live_<40 hex>`。返回明文 + 哈希 + 展示前缀。 */
export function generateApiKey(rand: (n: number) => Buffer = randomBytes): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `ap_sk_live_${rand(20).toString('hex')}`
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 15) }
}

// ── 数据操作（请求级客户端，RLS 生效）──────────────────────────
type Row = {
  id: string; name: string; key_prefix: string; scope: string
  last_used_at: string | null; revoked_at: string | null; created_at: string | null
  // V12-8.10：0034 已给 api_keys 加了这三列（Key 归一），数据层此前未跟上
  extension_id: string | null; scopes: unknown; expires_at: string | null
}
const COLS = 'id,name,key_prefix,scope,last_used_at,revoked_at,created_at,extension_id,scopes,expires_at'

function toMasked(r: Row): ApiKeyMasked {
  return {
    id: r.id,
    name: r.name,
    keyPrefix: `${r.key_prefix}${'*'.repeat(8)}`, // 前缀 + 掩码，绝不回明文/哈希
    scope: (r.scope as ApiKeyScope) ?? 'agent',
    status: r.revoked_at ? 'revoked' : 'active',
    lastUsedAt: r.last_used_at ? r.last_used_at.slice(0, 10) : null,
    createdAt: (r.created_at ?? '').slice(0, 10),
    extensionId: r.extension_id,
    scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
    expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : null,
  }
}

export async function listApiKeys(ctx: RequestContext): Promise<ApiKeyMasked[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_keys').select(COLS)
    .eq('org_id', ctx.orgId) // RLS + 显式 org_id 双层隔离（CLAUDE.md 铁律）
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toMasked)
}

/** 签发 Key：生成→哈希落库→**返回明文一次**（keyMasked + key 明文）。 */
export async function createApiKey(
  ctx: RequestContext,
  input: {
    name: string; scope: ApiKeyScope
    // V12-8.10：绑定到 Extension 时额外带这三项；不传即平台级通用 Key（4.8.6 原行为）
    extensionId?: string | null
    scopes?: string[]
    expiresAt?: string | null
  },
): Promise<{ key: string; masked: ApiKeyMasked }> {
  const { plaintext, hash, prefix } = generateApiKey()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      org_id: ctx.orgId, name: input.name, key_hash: hash, key_prefix: prefix,
      scope: input.scope, created_by: ctx.userId,
      extension_id: input.extensionId ?? null,
      // 默认最小授权：只给 chat，需要 leads 由调用方显式声明
      scopes: input.scopes?.length ? input.scopes : ['chat'],
      expires_at: input.expiresAt ?? null,
    })
    .select(COLS).single()
  if (error) throw new Error(error.message)
  return { key: plaintext, masked: toMasked(data as Row) }
}

// ── V12-8.5：Extension 对外调用的 Key 校验（ADR-020 §4）────────────
//
// 🔴 为什么这里可以用 service_role（ADR-002 铁律的边界说明）：
// 这是**身份识别**，不是业务查询——请求进来时还没有任何身份，而查 api_keys 表本身
// 就需要 auth.uid()，鸡生蛋。和"登录时校验密码必须先查用户表"是同一类操作。
// 边界卡死在三条上：
//   ① 只查 api_keys 一张表，② 只按 key_hash 精确匹配单行，③ 拿到身份立刻切回
//      请求级客户端（runWithExtensionToken）做业务查询。
// 绝不允许用这把钥匙去读业务数据——那才是 ADR-002 明令禁止的。

export type VerifiedKey = {
  keyId: string
  orgId: string
  extensionId: string
  scopes: string[]
  allowedOrigins: string[]
  rateLimitPerMin: number | null
  serviceUserId: string | null
  extensionStatus: string
  targetType: string
  targetId: string
}

type VerifyRow = {
  id: string; org_id: string; extension_id: string | null
  scopes: unknown; allowed_origins: unknown; rate_limit_per_min: number | null
  revoked_at: string | null; expires_at: string | null; deleted_at: string | null
  extensions: {
    id: string; status: string; target_type: string; target_id: string
    service_user_id: string | null; deleted_at: string | null
    rate_limit_per_min: number | null
    allowed_origins: unknown
  } | null
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 校验外部 Key。通过返回身份与治理配置，任何一项不满足一律返回 null（默认拒绝）。
 * 调用方只能得到"能不能进"，拿不到失败细节——不给探测者区分"Key 不存在"和"Key 已撤销"的机会。
 */
export async function verifyApiKey(plaintext: string): Promise<VerifiedKey | null> {
  const key = plaintext.trim()
  if (!key) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select(
      'id,org_id,extension_id,scopes,allowed_origins,rate_limit_per_min,revoked_at,expires_at,deleted_at,' +
        'extensions(id,status,target_type,target_id,service_user_id,deleted_at,rate_limit_per_min,allowed_origins)'
    )
    .eq('key_hash', hashApiKey(key))
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as VerifyRow

  if (row.revoked_at || row.deleted_at) return null
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null

  // 必须绑定到 Extension —— 4.8.6 的租户通用 Key（extension_id 为空）不得走对外入口
  const ext = row.extensions
  if (!row.extension_id || !ext) return null
  if (ext.deleted_at) return null
  // 目标未发布 / 已下线 → 拒绝（ADR-020 §8，对齐 AC-17：发布过 ≠ 永久可用）
  if (ext.status !== 'published') return null

  return {
    keyId: row.id,
    orgId: row.org_id,
    extensionId: ext.id,
    scopes: toStringArray(row.scopes),
    // 🔴 白名单优先取 Key 级覆盖，**回落到 Extension 级**。
    // 治理配置（来源/限流）是配在 Extension 上的，Key 级只是可选覆盖；
    // 初版只读 Key 的那一列，而它默认为空 → 白名单内的请求也被 403，
    // 且日志只显示"来源不在白名单内"，看不出是取错了地方。
    // 限流那行本就做了回落，白名单漏了——两者语义相同，应一致处理。
    allowedOrigins: toStringArray(row.allowed_origins).length
      ? toStringArray(row.allowed_origins)
      : toStringArray(ext.allowed_origins),
    rateLimitPerMin: row.rate_limit_per_min ?? ext.rate_limit_per_min ?? null,
    serviceUserId: ext.service_user_id,
    extensionStatus: ext.status,
    targetType: ext.target_type,
    targetId: ext.target_id,
  }
}

/** 记录 Key 最近使用时间（鉴权成功后异步调用，失败不影响主流程）。 */
export async function touchApiKeyUsage(keyId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId)
}

/** 吊销 Key（软吊销：置 revoked_at）。 */
export async function revokeApiKey(_ctx: RequestContext, id: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id).is('revoked_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  return ((data as { id: string }[] | null) ?? []).length > 0
}
