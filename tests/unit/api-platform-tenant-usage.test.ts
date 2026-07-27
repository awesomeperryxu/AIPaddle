/**
 * L3 集成测试 · GET /api/platform/tenant-usage
 * 覆盖：401 未登录 / 403 非平台超管 / 200 返回 { usage, revenueTrend }。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/platform-dashboard', () => ({
  getTenantUsage: vi.fn(),
  getPlatformRevenueTrend: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { getTenantUsage, getPlatformRevenueTrend } from '@/lib/data/platform-dashboard'
import { GET } from '@/app/api/platform/tenant-usage/route'

const mockCtx = vi.mocked(getRequestContext)
const mockPlat = vi.mocked(isPlatformAdmin)
const mockUsage = vi.mocked(getTenantUsage)
const mockTrend = vi.mocked(getPlatformRevenueTrend)

const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] } as never

beforeEach(() => vi.clearAllMocks())

describe('GET /api/platform/tenant-usage（ADR-010 平台超管门控）', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(mockUsage).not.toHaveBeenCalled()
  })

  it('403 非平台超管', async () => {
    mockCtx.mockResolvedValue(ctx); mockPlat.mockResolvedValue(false)
    expect((await GET()).status).toBe(403)
    expect(mockUsage).not.toHaveBeenCalled()
  })

  it('200 平台超管 → 返回 { usage, revenueTrend }', async () => {
    mockCtx.mockResolvedValue(ctx); mockPlat.mockResolvedValue(true)
    mockUsage.mockResolvedValue({ a: { members: 2, agents: 1, tokens30d: 2000, estCost30d: 0.0028 } })
    mockTrend.mockResolvedValue([{ label: '07月', cost: 2.8 }])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.usage.a).toEqual({ members: 2, agents: 1, tokens30d: 2000, estCost30d: 0.0028 })
    expect(body.revenueTrend).toEqual([{ label: '07月', cost: 2.8 }])
  })
})
