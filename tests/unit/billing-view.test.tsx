/**
 * L3 组件测试 · components/views/billing-view（4.8.7 去 mock + 真实按量估算）
 * 覆盖：当月真实用量 / 计费诚实标注「非结算账单」/ 无历史 mock 残留 / 空态
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BillingView } from '@/components/views/billing-view'
import type { BillingSummary } from '@/lib/data/billing'

const base: BillingSummary = {
  currentMonth: { label: '2026-07', tokens: 3_400_000, calls: 820, estCost: 8.88 },
  trend: [
    { label: '02月', tokens: 1_000_000, estCost: 2.1 }, { label: '03月', tokens: 2_000_000, estCost: 4.2 },
    { label: '04月', tokens: 1_500_000, estCost: 3.1 }, { label: '05月', tokens: 2_500_000, estCost: 5.5 },
    { label: '06月', tokens: 3_000_000, estCost: 7.0 }, { label: '07月', tokens: 3_400_000, estCost: 8.88 },
  ],
  byModel: [{ model: 'qwen-plus', tokens: 3_400_000, estCost: 8.88, pct: 100 }],
  billingEnabled: false,
}

describe('BillingView', () => {
  it('渲染当月真实用量', () => {
    render(<BillingView data={base} />)
    expect(screen.getByText('当月调用次数')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(screen.getAllByText('3.40M').length).toBeGreaterThan(0)
    expect(screen.getAllByText('¥8.88').length).toBeGreaterThan(0)
  })

  it('计费诚实标注「非结算账单」', () => {
    render(<BillingView data={base} />)
    expect(screen.getByText(/计费引擎尚未上线/)).toBeInTheDocument()
    expect(screen.getByText(/非结算账单/)).toBeInTheDocument()
  })

  it('无历史 mock 残留（示范科技 / INV- / 34280 / 逾期账单）', () => {
    render(<BillingView data={base} />)
    expect(screen.queryByText(/示范科技/)).toBeNull()
    expect(screen.queryByText(/INV-/)).toBeNull()
    expect(screen.queryByText(/34,280/)).toBeNull()
    expect(screen.queryByText(/已逾期/)).toBeNull()
  })

  it('空数据 → 友好空态', () => {
    const empty: BillingSummary = {
      currentMonth: { label: '2026-07', tokens: 0, calls: 0, estCost: 0 },
      trend: [{ label: '07月', tokens: 0, estCost: 0 }], byModel: [], billingEnabled: false,
    }
    render(<BillingView data={empty} />)
    expect(screen.getByText(/暂无调用记录/)).toBeInTheDocument()
    expect(screen.getByText(/当月暂无调用/)).toBeInTheDocument()
  })
})
