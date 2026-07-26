/**
 * L2 单元测试 · 4.8.2 配额强制纯逻辑
 * - lib/ratelimit：进程内令牌桶（突发/回填/retryAfter/不限流）
 * - lib/data/quota decideQuota：limit<=0 不限；used(+incoming) 超限拒绝
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, __resetRateLimit } from '@/lib/ratelimit'
import { decideQuota } from '@/lib/data/quota'

beforeEach(() => __resetRateLimit())

describe('checkRateLimit（令牌桶）', () => {
  it('qps<=0 视为不限流', () => {
    for (let i = 0; i < 100; i++) expect(checkRateLimit('org', 0, 1000).ok).toBe(true)
  })

  it('突发容量=qps：前 qps 次放行，第 qps+1 次拒绝', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) expect(checkRateLimit('orgA', 5, t).ok).toBe(true)
    const denied = checkRateLimit('orgA', 5, t)
    expect(denied.ok).toBe(false)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
  })

  it('回填：耗尽后经过时间可再次放行', () => {
    const t0 = 2_000_000
    for (let i = 0; i < 5; i++) checkRateLimit('orgB', 5, t0)
    expect(checkRateLimit('orgB', 5, t0).ok).toBe(false)          // 立即再请求被拒
    expect(checkRateLimit('orgB', 5, t0 + 200).ok).toBe(true)     // 200ms 回填 1 个(5/s)
  })

  it('各 org 独立桶，互不影响', () => {
    const t = 3_000_000
    for (let i = 0; i < 3; i++) checkRateLimit('o1', 3, t)
    expect(checkRateLimit('o1', 3, t).ok).toBe(false)
    expect(checkRateLimit('o2', 3, t).ok).toBe(true)              // o2 满桶
  })
})

describe('decideQuota（配额决策）', () => {
  it('limit<=0 视为不限制', () => {
    expect(decideQuota(999, 0).ok).toBe(true)
    expect(decideQuota(999, -1).ok).toBe(true)
  })
  it('用量(+本次)未超 → 放行', () => {
    expect(decideQuota(800, 1000).ok).toBe(true)
    expect(decideQuota(800, 1000, 200).ok).toBe(true)   // 800+200=1000，等于不算超
  })
  it('用量(+本次)超限 → 拒绝', () => {
    expect(decideQuota(1001, 1000).ok).toBe(false)
    expect(decideQuota(900, 1000, 200).ok).toBe(false)  // 900+200>1000
  })
})
