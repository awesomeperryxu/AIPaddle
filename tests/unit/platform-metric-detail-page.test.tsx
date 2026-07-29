/**
 * L2 单元 · 平台指标明细页 /platform-metrics/[metric]
 * 验证：动态段合法值渲染视图、非法值 notFound()、非平台超管返回无权限、未登录重定向。
 * 服务端页只调 lib/data/*，全部 mock 掉数据层与门控。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  notFound, redirect, getRequestContext, isPlatformAdmin,
  listAllTenants, getTenantUsage, getPlatformDashboard,
} = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT') }),
  getRequestContext: vi.fn(),
  isPlatformAdmin: vi.fn(),
  listAllTenants: vi.fn(),
  getTenantUsage: vi.fn(),
  getPlatformDashboard: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound, redirect }))
vi.mock('@/lib/context', () => ({ getRequestContext }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin }))
vi.mock('@/lib/data/tenants', () => ({ listAllTenants }))
vi.mock('@/lib/data/platform-dashboard', () => ({ getTenantUsage, getPlatformDashboard }))

// 视图 mock 成透明壳：只回读收到的 props，避免拉进 client 依赖
vi.mock('@/components/views/platform-metric-detail-view', () => ({
  PlatformMetricDetailView: (props: Record<string, unknown>) => ({ __view: true, props }),
}))

import Page from '@/app/(dashboard)/platform-metrics/[metric]/page'

const CTX = { userId: 'u1', orgId: 'o1', roles: [] }

beforeEach(() => {
  vi.clearAllMocks()
  getRequestContext.mockResolvedValue(CTX)
  isPlatformAdmin.mockResolvedValue(true)
  listAllTenants.mockResolvedValue([
    { id: 't1', name: '甲公司', status: 'active', createdAt: '2026-01-01' },
    { id: 't2', name: '乙公司', status: 'suspended', createdAt: '2026-02-01' },
  ])
  getTenantUsage.mockResolvedValue({
    t1: { members: 3, agents: 2, tokens30d: 1000, calls30d: 5, estCost30d: 1.2 },
  })
  getPlatformDashboard.mockResolvedValue({ modelCost: [{ model: 'qwen', tokens: 1, cost: 1, pct: 100 }], tokenTrend: [{ label: '01月', tokens: 1 }] })
})

const run = (metric: string) => Page({ params: Promise.resolve({ metric }) })

describe('平台指标明细页', () => {
  it.each(['members', 'agents', 'tokens', 'calls', 'cost', 'tenants'])(
    '合法指标 %s → 渲染明细视图，不 notFound', async (metric) => {
      const el = (await run(metric)) as unknown as { props: { metric: string } }
      expect(notFound).not.toHaveBeenCalled()
      expect(el.props.metric).toBe(metric)
      expect(el.props).toHaveProperty('usage')
      expect(el.props).toHaveProperty('tenants')
    },
  )

  it('非法指标 → notFound()', async () => {
    await expect(run('bogus')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('cost 指标额外拉取 modelCost（getPlatformDashboard）', async () => {
    await run('cost')
    expect(getPlatformDashboard).toHaveBeenCalledTimes(1)
  })

  it('members 指标不多拉 getPlatformDashboard', async () => {
    await run('members')
    expect(getPlatformDashboard).not.toHaveBeenCalled()
  })

  it('非平台超管 → 返回无权限，不 notFound、不取数', async () => {
    isPlatformAdmin.mockResolvedValue(false)
    await run('members')
    expect(notFound).not.toHaveBeenCalled()
    expect(listAllTenants).not.toHaveBeenCalled()
  })

  it('未登录 → redirect(/login)', async () => {
    getRequestContext.mockResolvedValue(null)
    await expect(run('members')).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
