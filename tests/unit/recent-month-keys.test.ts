/**
 * L1 单测 · 近 N 个自然月的分桶（BUG：31 号串月）
 *
 * 复现缺陷：原实现用 `now - i*30*DAY` 倒推月份。自然月是 28~31 天，30 天定长会串月——
 * 2026-07-31 减 30 天仍是 2026-07-01，于是「上月」与「本月」都算成 2026-07：
 *   · 6 个桶里出现**重复月份**，实际只覆盖 5 个月；
 *   · 当月成本在趋势图上被**画两遍**。
 *
 * 影响面：平台运营大盘的 Token 趋势 + 租户管理页的收入趋势（两处共用同一段代码）。
 *
 * 这类缺陷**日期敏感**——只在每月 31 号及 2 月前后必现，平时跑测试完全看不见，
 * 所以本用例一律传固定时间戳，不用 `new Date()`。
 */
import { describe, it, expect } from 'vitest'
import { recentMonthKeys } from '@/lib/data/platform-dashboard'

const at = (iso: string) => Date.parse(iso)

describe('recentMonthKeys', () => {
  it('🔴 31 号不串月（原实现在此重复出现当月）', () => {
    const keys = recentMonthKeys(at('2026-07-31T12:00:00Z'))
    expect(keys).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'])
    expect(new Set(keys).size).toBe(6) // 无重复
  })

  it('🔴 任何一天都必须产出 6 个互不相同的月份', () => {
    // 逐日扫一整年，把所有月长组合都覆盖到（含 2 月、闰年、大小月交界）
    for (let d = Date.parse('2026-01-01T00:00:00Z'); d <= Date.parse('2026-12-31T00:00:00Z'); d += 86_400_000) {
      const keys = recentMonthKeys(d)
      expect(keys, `${new Date(d).toISOString().slice(0, 10)} 产生了重复月份：${keys.join(',')}`)
        .toHaveLength(6)
      expect(new Set(keys).size, `${new Date(d).toISOString().slice(0, 10)} 去重后不足 6 个：${keys.join(',')}`)
        .toBe(6)
    }
  })

  it('末位恒为当月', () => {
    expect(recentMonthKeys(at('2026-07-31T00:00:00Z')).at(-1)).toBe('2026-07')
    expect(recentMonthKeys(at('2026-01-01T00:00:00Z')).at(-1)).toBe('2026-01')
  })

  it('跨年正确回退', () => {
    expect(recentMonthKeys(at('2026-01-15T00:00:00Z')))
      .toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'])
  })

  it('闰年 2 月不塌陷（2 月只有 28/29 天，30 天定长在此也会串）', () => {
    expect(recentMonthKeys(at('2028-02-29T00:00:00Z')))
      .toEqual(['2027-09', '2027-10', '2027-11', '2027-12', '2028-01', '2028-02'])
  })

  it('count 可调', () => {
    expect(recentMonthKeys(at('2026-07-31T00:00:00Z'), 3)).toEqual(['2026-05', '2026-06', '2026-07'])
  })
})
