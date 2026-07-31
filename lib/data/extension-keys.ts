import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// V12-8.5 / ADR-020 §6：Extension 对外调用 Key。
//
// 🔴 铁律（同 4.8.6 api_keys、同成员密码）：
//   · 明文**仅签发时一次性返回**，落库只存 sha256 + 可展示前缀；
//   · 明文绝不入库、不进日志、不进响应体（除签发那一次）、不进审计 detail（AC-15）；
//   · 撤销走 revoked_at 而非删除——删掉就查不出这个 Key 曾调过什么。

export type ExtKeyScope = 'chat' | 'leads'
export const EXT_KEY_SCOPES: readonly ExtKeyScope[] = ['chat', 'leads'] as const

export type ExtKeyMasked = {
  id: string
  extensionId: string
  name: string
  keyPrefix: string
  scopes: ExtKeyScope[]
  status: 'active' | 'revoked' | 'expired'
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// ── 纯函数（可单测；randomBytes 可注入）──────────────────────────────────

export function hashExtKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * 生成 Key：`ap_ext_<40 hex>`。
 * 前缀用 `ap_ext_` 与平台级 `ap_sk_live_`（4.8.6）区分——出问题时看一眼就知道
 * 是哪套 Key 体系，不必回库查。
 */
export function generateExtKey(rand: (n: number) => Buffer = randomBytes): {
  plaintext: string; hash: string; prefix: string
} {
  const plaintext = `ap_ext_${rand(20).toString('hex')}`
  return { plaintext, hash: hashExtKey(plaintext), prefix: plaintext.slice(0, 14) }
}

/**
 * 定长比较，避免按字符提前返回而泄漏信息（时序攻击）。
 * 两者都是 sha256 十六进制串，长度恒等；长度不等直接判否。
 */
export function safeHashEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8'), bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** 从 Authorization 头取 Bearer Token；格式不符返回 null。 */
export function parseBearer(header: string | null): string | null {
  if (!header) return null
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return m ? m[1] : null
}

// ── 数据操作 ────────────────────────────────────────────────────────────

type Row = {
  id: string; extension_id: string; name: string; key_prefix: string
  scopes: unknown; last_used_at: string | null; expires_at: string | null
  revoked_at: string | null; created_at: string | null
}
const COLS = 'id,extension_id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at'

function toMasked(r: Row): ExtKeyMasked {
  const expired = !!r.expires_at && Date.parse(r.expires_at) < Date.now()
  return {
    id: r.id,
    extensionId: r.extension_id,
    name: r.name,
    // 前缀 + 掩码，绝不回明文/哈希
    keyPrefix: `${r.key_prefix}${'*'.repeat(8)}`,
    scopes: Array.isArray(r.scopes) ? (r.scopes as ExtKeyScope[]) : ['chat'],
    status: r.revoked_at ? 'revoked' : expired ? 'expired' : 'active',
    lastUsedAt: r.last_used_at ? r.last_used_at.slice(0, 10) : null,
    expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : null,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

export async function listExtKeys(ctx: RequestContext, extensionId: string): Promise<ExtKeyMasked[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extension_api_keys').select(COLS)
    .eq('org_id', ctx.orgId).eq('extension_id', extensionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toMasked)
}

/**
 * 签发。返回的 `plaintext` 是**唯一一次**能拿到明文的机会——
 * 调用方必须直接交给用户，不得记录、不得回写、不得进审计。
 */
export async function issueExtKey(
  ctx: RequestContext,
  input: { extensionId: string; name: string; scopes?: ExtKeyScope[]; expiresAt?: string | null; rateLimitPerMin?: number | null },
): Promise<{ key: ExtKeyMasked; plaintext: string }> {
  const name = input.name?.trim()
  if (!name) throw new Error('Key 名称不能为空')
  const scopes = (input.scopes?.length ? input.scopes : ['chat']) as ExtKeyScope[]
  for (const s of scopes) {
    if (!EXT_KEY_SCOPES.includes(s)) throw new Error(`未知 scope：${s}`)
  }

  const { plaintext, hash, prefix } = generateExtKey()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extension_api_keys')
    .insert({
      org_id: ctx.orgId,
      extension_id: input.extensionId,
      name,
      key_hash: hash,
      key_prefix: prefix,
      scopes,
      expires_at: input.expiresAt ?? null,
      rate_limit_per_min: input.rateLimitPerMin ?? null,
      created_by: ctx.userId,
    })
    .select(COLS).single()
  if (error) throw new Error(error.message)
  return { key: toMasked(data as Row), plaintext }
}

/** 撤销：置 revoked_at，不删行（保留可审计性）。已撤销的再撤返回 false（幂等）。 */
export async function revokeExtKey(ctx: RequestContext, id: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extension_api_keys')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', ctx.orgId)
    .is('deleted_at', null).is('revoked_at', null)
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

/**
 * 校验外部请求携带的 Key。
 *
 * 🔴 用 admin client：此处**尚未确定租户**，正是要由 Key 反查出 org_id，
 * 请求级客户端在这一步没有任何身份可用（RLS 会挡住一切）。这是 ADR-002 允许的
 * 「跨租户运维」场景之一——但**仅限这一步**，拿到 org 之后的所有业务查询
 * 一律回到请求级客户端（见 V12-8.6 getExtensionContext）。
 *
 * 返回 null 的全部情形一律由调用方回 401，**不区分原因**——
 * 区分「Key 不存在」与「Key 已撤销」会给攻击者提供枚举线索。
 */
export type ExtKeyAuth = {
  keyId: string
  orgId: string
  extensionId: string
  scopes: ExtKeyScope[]
  rateLimitPerMin: number | null
}

export async function verifyExtKey(plaintext: string): Promise<ExtKeyAuth | null> {
  if (!plaintext || !plaintext.startsWith('ap_ext_')) return null
  const hash = hashExtKey(plaintext)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('extension_api_keys')
    .select('id,org_id,extension_id,scopes,key_hash,expires_at,rate_limit_per_min')
    .eq('key_hash', hash)
    .is('deleted_at', null).is('revoked_at', null)
    .maybeSingle()
  if (error || !data) return null

  const row = data as {
    id: string; org_id: string; extension_id: string; scopes: unknown
    key_hash: string; expires_at: string | null; rate_limit_per_min: number | null
  }
  // 即便已按 hash 命中，仍做一次定长比较——防御 DB 侧索引/比较实现的时序差异
  if (!safeHashEqual(row.key_hash, hash)) return null
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null

  return {
    keyId: row.id,
    orgId: row.org_id,
    extensionId: row.extension_id,
    scopes: Array.isArray(row.scopes) ? (row.scopes as ExtKeyScope[]) : ['chat'],
    rateLimitPerMin: row.rate_limit_per_min,
  }
}

/** 记录最近使用时间（异步打点，失败不影响主流程）。 */
export async function touchExtKey(keyId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('extension_api_keys')
      .update({ last_used_at: new Date().toISOString() }).eq('id', keyId)
  } catch {
    // 打点失败不应让外部调用失败
  }
}
