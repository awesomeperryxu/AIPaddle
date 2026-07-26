// ADR-010 / 4.8.2：进程内令牌桶 QPS 限流（按 org）。
// ⚠️ 单实例级：aipaddle.net 为 Next standalone + PM2 单实例，模块级状态跨请求持久，可用。
// 多实例部署时须换 Redis/Upstash（见 ROADMAP 通道 G 4.8.2 备注）。用户已拍板本方案（2026-07-26）。

type Bucket = { tokens: number; last: number }
const buckets = new Map<string, Bucket>()

export type RateResult = { ok: boolean; retryAfterMs: number }

/**
 * 令牌桶：容量 = qps（允许瞬时突发 qps 次），每秒回填 qps 个令牌。
 * @param key   限流键（一般是 orgId）
 * @param qps   每秒允许请求数（租户 qps_limit）；<=0 视为不限流
 * @param now   当前毫秒时间戳（默认 Date.now；测试可注入）
 */
export function checkRateLimit(key: string, qps: number, now: number = Date.now()): RateResult {
  if (!Number.isFinite(qps) || qps <= 0) return { ok: true, retryAfterMs: 0 }
  const capacity = qps
  const refillPerMs = qps / 1000
  let b = buckets.get(key)
  if (!b) { b = { tokens: capacity, last: now }; buckets.set(key, b) }

  // 按流逝时间回填，封顶容量
  const elapsed = Math.max(0, now - b.last)
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerMs)
  b.last = now

  if (b.tokens >= 1) {
    b.tokens -= 1
    return { ok: true, retryAfterMs: 0 }
  }
  // 不足 1 个令牌：算出补满 1 个还需多久
  const needed = 1 - b.tokens
  return { ok: false, retryAfterMs: Math.ceil(needed / refillPerMs) }
}

/** 测试用：清空所有桶。 */
export function __resetRateLimit() { buckets.clear() }
