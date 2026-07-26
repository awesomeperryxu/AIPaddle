import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

// ADR-010 / 4.8.2：配额强制（token 熔断 + 存储校验）。请求级客户端（RLS 生效，只读本租户）。
// 铁律（PRD v1.10 §2.9.0）：配额必有强制点，不仅展示。0/未配额度视为「不限制」。

export type QuotaVerdict = { ok: boolean; used: number; limit: number; incoming?: number }

/** 纯决策：limit<=0 视为不限制；used(+incoming) 超过 limit 即拒绝。可单测。 */
export function decideQuota(used: number, limit: number, incoming = 0): QuotaVerdict {
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true, used, limit, incoming }
  return { ok: used + incoming <= limit, used, limit, incoming }
}

const DAY = 86_400_000

async function tenantQuota(ctx: RequestContext, col: 'token_quota' | 'storage_quota') {
  const supabase = await createClient()
  const { data } = await supabase.from('tenants').select(col).eq('id', ctx.orgId).maybeSingle()
  const v = (data as Record<string, number | null> | null)?.[col]
  return typeof v === 'number' ? v : 0
}

/** Token 熔断：近 30 天 call_logs 用量(in+out) vs tenants.token_quota。 */
export async function checkTokenQuota(ctx: RequestContext): Promise<QuotaVerdict> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 30 * DAY).toISOString()
  const [{ data: logs }, limit] = await Promise.all([
    supabase.from('call_logs').select('tokens_in,tokens_out').is('deleted_at', null).gte('created_at', since),
    tenantQuota(ctx, 'token_quota'),
  ])
  const used = ((logs as { tokens_in: number | null; tokens_out: number | null }[] | null) ?? [])
    .reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
  return decideQuota(used, limit)
}

/** 存储校验：本租户在册文档 size_bytes 之和 + 本次上传 vs tenants.storage_quota。 */
export async function checkStorageQuota(ctx: RequestContext, incomingBytes: number): Promise<QuotaVerdict> {
  const supabase = await createClient()
  const [{ data: docs }, limit] = await Promise.all([
    supabase.from('documents').select('size_bytes').is('deleted_at', null),
    tenantQuota(ctx, 'storage_quota'),
  ])
  const used = ((docs as { size_bytes: number | null }[] | null) ?? [])
    .reduce((s, d) => s + (d.size_bytes ?? 0), 0)
  return decideQuota(used, limit, incomingBytes)
}

export type EnforceResult = { ok: true } | { ok: false; status: number; code: string; message: string }

/**
 * LLM 调用前置强制：QPS 令牌桶 + Token 熔断。任一超限即拒绝（429）。
 * 一次读租户 qps_limit + token_quota；用量走近 30 天 call_logs。
 */
export async function enforceLlmQuota(ctx: RequestContext): Promise<EnforceResult> {
  const supabase = await createClient()
  const { data: t } = await supabase
    .from('tenants').select('qps_limit,token_quota').eq('id', ctx.orgId).maybeSingle()
  const qps = (t as { qps_limit: number | null } | null)?.qps_limit ?? 0
  const tokenLimit = (t as { token_quota: number | null } | null)?.token_quota ?? 0

  // 1) QPS 令牌桶（进程内，单实例级）
  const rl = checkRateLimit(ctx.orgId, qps)
  if (!rl.ok) {
    return { ok: false, status: 429, code: 'rate_limited', message: `请求过于频繁，请 ${Math.ceil(rl.retryAfterMs / 1000)}s 后重试` }
  }

  // 2) Token 熔断（近 30 天用量 vs 配额）
  const since = new Date(Date.now() - 30 * DAY).toISOString()
  const { data: logs } = await supabase
    .from('call_logs').select('tokens_in,tokens_out').is('deleted_at', null).gte('created_at', since)
  const used = ((logs as { tokens_in: number | null; tokens_out: number | null }[] | null) ?? [])
    .reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
  const v = decideQuota(used, tokenLimit)
  if (!v.ok) {
    return { ok: false, status: 429, code: 'token_quota_exceeded', message: `近 30 天 Token 配额已用尽（${(used / 1e6).toFixed(2)}M / ${(tokenLimit / 1e6).toFixed(2)}M），请联系管理员提升配额` }
  }
  return { ok: true }
}
