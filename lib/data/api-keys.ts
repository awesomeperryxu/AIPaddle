import 'server-only'
import { createHash, randomBytes } from 'crypto'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

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
}
const COLS = 'id,name,key_prefix,scope,last_used_at,revoked_at,created_at'

function toMasked(r: Row): ApiKeyMasked {
  return {
    id: r.id,
    name: r.name,
    keyPrefix: `${r.key_prefix}${'*'.repeat(8)}`, // 前缀 + 掩码，绝不回明文/哈希
    scope: (r.scope as ApiKeyScope) ?? 'agent',
    status: r.revoked_at ? 'revoked' : 'active',
    lastUsedAt: r.last_used_at ? r.last_used_at.slice(0, 10) : null,
    createdAt: (r.created_at ?? '').slice(0, 10),
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
  input: { name: string; scope: ApiKeyScope },
): Promise<{ key: string; masked: ApiKeyMasked }> {
  const { plaintext, hash, prefix } = generateApiKey()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      org_id: ctx.orgId, name: input.name, key_hash: hash, key_prefix: prefix,
      scope: input.scope, created_by: ctx.userId,
    })
    .select(COLS).single()
  if (error) throw new Error(error.message)
  return { key: plaintext, masked: toMasked(data as Row) }
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
