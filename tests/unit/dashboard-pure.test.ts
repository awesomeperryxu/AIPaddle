/**
 * 单元 · lib/data/dashboard 纯函数（BUG-74）
 * estimateCost（成本估算）与 bucketByDay（按日分桶）不触碰 supabase，可纯测。
 */
import { describe, it, expect } from 'vitest'
import { estimateCost, bucketByDay, QWEN_PLUS_PRICE, type CallLogLike } from '@/lib/data/dashboard'

describe('estimateCost', () => {
  it('按 token 单价估算成本（元）', () => {
    // 1000 in * 0.0008 + 1000 out * 0.002 = 0.0008 + 0.002 = 0.0028
    expect(estimateCost(1000, 1000)).toBeCloseTo(0.0028, 6)
  })

  it('零 token → 0 成本', () => {
    expect(estimateCost(0, 0)).toBe(0)
  })

  it('与导出的单价常量一致', () => {
    expect(estimateCost(2000, 0)).toBeCloseTo(2 * QWEN_PLUS_PRICE.in, 6)
    expect(estimateCost(0, 3000)).toBeCloseTo(3 * QWEN_PLUS_PRICE.out, 6)
  })
})

describe('bucketByDay', () => {
  const now = new Date('2026-07-21T12:00:00Z')

  it('生成恰好 days 个自然日桶，按 MM/DD 顺序排列', () => {
    const out = bucketByDay([], 12, now)
    expect(out).toHaveLength(12)
    expect(out[0].date).toBe('07/10')
    expect(out[11].date).toBe('07/21')
    // 空数据每天回落：0 调用、成功率 100
    expect(out[11]).toMatchObject({ calls: 0, tokens: 0, cost: 0, activeUsers: 0, successRate: 100 })
  })

  it('按 UTC 自然日归组调用、token、成本、活跃用户与成功率', () => {
    const logs: CallLogLike[] = [
      { created_at: '2026-07-21T01:00:00Z', tokens_in: 1000, tokens_out: 1000, success: true, user_id: 'u1' },
      { created_at: '2026-07-21T09:00:00Z', tokens_in: 1000, tokens_out: 0, success: false, user_id: 'u2' },
      { created_at: '2026-07-21T23:00:00Z', tokens_in: 0, tokens_out: 0, success: true, user_id: 'u1' },
      { created_at: '2026-07-20T10:00:00Z', tokens_in: 500, tokens_out: 500, success: true, user_id: 'u3' },
    ]
    const out = bucketByDay(logs, 12, now)
    const today = out[11]
    expect(today.calls).toBe(3)
    expect(today.tokens).toBe(3000) // 2000 + 1000 + 0
    expect(today.activeUsers).toBe(2) // u1, u2（u1 去重）
    expect(today.successRate).toBe(66.7) // 2/3
    expect(today.cost).toBeCloseTo(estimateCost(2000, 1000) + estimateCost(1000, 0), 2)

    const yesterday = out[10]
    expect(yesterday.calls).toBe(1)
    expect(yesterday.successRate).toBe(100)
  })

  it('忽略无 created_at 的行', () => {
    const logs: CallLogLike[] = [
      { created_at: null, tokens_in: 100, tokens_out: 100, success: true, user_id: 'u1' },
    ]
    const out = bucketByDay(logs, 3, now)
    expect(out.every(d => d.calls === 0)).toBe(true)
  })
})
