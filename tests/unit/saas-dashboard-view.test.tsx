/**
 * L3 组件测试 · components/views/saas-dashboard-view（4.8.1 去 mock + 真实数据）
 * 覆盖：真实 KPI 渲染 / 计费诚实标注「即将上线」/ 超配额徽标 / 风险空态 /
 *       无历史 mock 残留（MRR ¥6,810 等）
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// recharts 在 jsdom 下依赖 ResizeObserver，测试聚焦渲染逻辑，故 mock 掉图表库。
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub, AreaChart: Stub, Area: () => null,
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
  }
})

import { SaasDashboardView } from '@/components/views/saas-dashboard-view'
import type { PlatformDashboard } from '@/lib/data/platform-dashboard'

const base: PlatformDashboard = {
  tenants: { total: 3, active: 2, suspended: 1, byPlan: { free: 1, standard: 1, enterprise: 1 } },
  usage30d: { tokens: 5_400_000, calls: 1234, estCost: 12.34 },
  tokenTrend: [
    { label: '02月', tokens: 1_000_000 }, { label: '03月', tokens: 2_000_000 },
    { label: '04月', tokens: 1_500_000 }, { label: '05月', tokens: 3_000_000 },
    { label: '06月', tokens: 2_500_000 }, { label: '07月', tokens: 5_400_000 },
  ],
  tenantRanking: [
    { name: '云帆物流', tokenUsage: 5_400_000, tokenQuota: 5_000_000, over: true },
    { name: '创新金融', tokenUsage: 2_300_000, tokenQuota: 8_000_000, over: false },
  ],
  modelCost: [{ model: 'qwen-plus', tokens: 5_400_000, cost: 12.34, pct: 100 }],
  risks: [{ level: 'high', title: '云帆物流 · Token 超配额', detail: '近 30 天已用 5.40M / 配额 5.00M（超 8%）' }],
  billingEnabled: false,
}

describe('SaasDashboardView', () => {
  it('渲染真实 KPI（租户/Token/调用/估算成本）', () => {
    render(<SaasDashboardView data={base} />)
    expect(screen.getByText('租户总数')).toBeInTheDocument()
    expect(screen.getByText('活跃 2 · 停用 1')).toBeInTheDocument()
    expect(screen.getAllByText('5.40M').length).toBeGreaterThan(0) // 近30天 token
    expect(screen.getAllByText('¥12.34').length).toBeGreaterThan(0) // 估算成本
  })

  it('计费类指标诚实标注「即将上线」，不显示收入估算', () => {
    render(<SaasDashboardView data={base} />)
    expect(screen.getByText(/计费相关指标（MRR \/ ARPU \/ 逾期应收）即将上线/)).toBeInTheDocument()
  })

  it('超配额租户显示徽标 + 真实风险项', () => {
    render(<SaasDashboardView data={base} />)
    expect(screen.getByText('云帆物流')).toBeInTheDocument()
    expect(screen.getAllByText('超配额').length).toBeGreaterThan(0)
    expect(screen.getByText('云帆物流 · Token 超配额')).toBeInTheDocument()
  })

  it('无历史 mock 残留（MRR ¥6,810 / GPT-4-Turbo / 华润三九）', () => {
    render(<SaasDashboardView data={base} />)
    expect(screen.queryByText(/6,810/)).toBeNull()
    expect(screen.queryByText(/GPT-4-Turbo/)).toBeNull()
    expect(screen.queryByText(/华润三九/)).toBeNull()
  })

  it('空数据 → 友好空态，无风险时提示无风险', () => {
    const empty: PlatformDashboard = {
      tenants: { total: 0, active: 0, suspended: 0, byPlan: {} },
      usage30d: { tokens: 0, calls: 0, estCost: 0 },
      tokenTrend: [{ label: '07月', tokens: 0 }],
      tenantRanking: [], modelCost: [], risks: [], billingEnabled: false,
    }
    render(<SaasDashboardView data={empty} />)
    expect(screen.getByText(/暂无风险项/)).toBeInTheDocument()
    expect(screen.getAllByText(/暂无/).length).toBeGreaterThan(0)
  })
})
