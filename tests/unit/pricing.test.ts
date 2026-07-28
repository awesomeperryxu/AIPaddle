/**
 * L2 单元测试 · 4.8.17c/d 定价查找与成本计算（纯函数，不碰库）
 *
 * 核心契约：**按调用发生当时生效的单价计费**——改价不篡改历史成本。
 * 这正是硬编码单价的老毛病：一个常量算所有历史，改一次价整条趋势线跟着变形。
 */
import { describe, it, expect } from 'vitest'
import { PricingTable, isPricingStale, PRICING_STALE_DAYS, type PriceRow } from '@/lib/pricing'

const row = (provider: string, model: string, i: number, o: number, from: string): PriceRow => ({
  provider, model, inputPer1k: i, outputPer1k: o, effectiveFrom: from,
})

// 同一模型两个价位档：7 月起涨价
const TABLE = new PricingTable([
  row('platform-env', 'qwen-plus', 0.0008, 0.002, '2026-01-01T00:00:00Z'),
  row('platform-env', 'qwen-plus', 0.0008, 0.0048, '2026-07-01T00:00:00Z'),
  row('platform-env', '*', 0.001, 0.003, '2026-01-01T00:00:00Z'),
  row('*', '*', 0.002, 0.006, '2026-01-01T00:00:00Z'),
])

describe('PricingTable.priceAt · 版本化取价', () => {
  it('取调用当时生效的档（涨价前）', () => {
    expect(TABLE.priceAt('platform-env', 'qwen-plus', '2026-06-30T00:00:00Z')?.outputPer1k).toBe(0.002)
  })

  it('取调用当时生效的档（涨价后）', () => {
    expect(TABLE.priceAt('platform-env', 'qwen-plus', '2026-07-15T00:00:00Z')?.outputPer1k).toBe(0.0048)
  })

  it('生效当刻即算新档（边界含等号）', () => {
    expect(TABLE.priceAt('platform-env', 'qwen-plus', '2026-07-01T00:00:00Z')?.outputPer1k).toBe(0.0048)
  })

  it('早于所有生效时间 → 无定价（不回退到未来的价）', () => {
    expect(TABLE.priceAt('platform-env', 'qwen-plus', '2025-12-31T00:00:00Z')).toBeNull()
  })

  it('模型未单独配价 → 回退该供应商的 * 兜底档', () => {
    const p = TABLE.priceAt('platform-env', 'qwen-max', '2026-07-15T00:00:00Z')
    expect(p?.inputPer1k).toBe(0.001)
  })

  it('供应商也未配 → 回退全局 *::*', () => {
    const p = TABLE.priceAt('some-vendor', 'some-model', '2026-07-15T00:00:00Z')
    expect(p?.inputPer1k).toBe(0.002)
  })

  it('空表 → 一律无定价', () => {
    expect(new PricingTable([]).priceAt('x', 'y', '2026-07-15T00:00:00Z')).toBeNull()
  })
})

describe('PricingTable.costOf · 成本计算', () => {
  it('按当时单价算：1K 入 + 1K 出（涨价前）', () => {
    const c = TABLE.costOf({
      provider: 'platform-env', model: 'qwen-plus',
      tokens_in: 1000, tokens_out: 1000, created_at: '2026-06-01T00:00:00Z',
    })
    expect(c).toBeCloseTo(0.0008 + 0.002, 10)
  })

  it('同样的用量，涨价后成本更高——历史不受改价影响', () => {
    const before = TABLE.costOf({
      provider: 'platform-env', model: 'qwen-plus',
      tokens_in: 1000, tokens_out: 1000, created_at: '2026-06-01T00:00:00Z',
    })!
    const after = TABLE.costOf({
      provider: 'platform-env', model: 'qwen-plus',
      tokens_in: 1000, tokens_out: 1000, created_at: '2026-08-01T00:00:00Z',
    })!
    expect(after).toBeGreaterThan(before)
    expect(before).toBeCloseTo(0.0028, 10)   // 老档口径保持不变
  })

  it('无匹配定价 → 返回 null（由调用方决定呈现，绝不静默按 0 计）', () => {
    const c = new PricingTable([]).costOf({ provider: 'x', model: 'y', tokens_in: 1000, tokens_out: 1000 })
    expect(c).toBeNull()
  })

  it('token 缺失按 0 处理，不炸', () => {
    expect(TABLE.costOf({ provider: 'platform-env', model: 'qwen-plus', created_at: '2026-08-01T00:00:00Z' })).toBe(0)
  })
})

describe('isPricingStale · 4.8.17d 陈旧告警', () => {
  const now = new Date('2026-07-28T00:00:00Z').getTime()

  it('从未配置过定价 → 视为陈旧', () => {
    expect(isPricingStale(null, now)).toBe(true)
  })

  it(`超过 ${PRICING_STALE_DAYS} 天未更新 → 陈旧`, () => {
    expect(isPricingStale('2026-01-01T00:00:00Z', now)).toBe(true)
  })

  it('近期更新过 → 不陈旧', () => {
    expect(isPricingStale('2026-07-01T00:00:00Z', now)).toBe(false)
  })
})
