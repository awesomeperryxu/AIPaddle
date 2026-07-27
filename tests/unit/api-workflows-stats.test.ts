import { describe, it, expect, vi, beforeEach } from 'vitest'

// GX-5：GET /api/workflows/stats —— workflow:read 门控，返回 { stats }。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/workflow', () => ({
  getWorkflowRunStats: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { getWorkflowRunStats } from '@/lib/data/workflow'
import { GET } from '@/app/api/workflows/stats/route'

const mockCtx = vi.mocked(getRequestContext)
const mockStats = vi.mocked(getWorkflowRunStats)

describe('GET /api/workflows/stats（GX-5 运行统计端点）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect(mockStats).not.toHaveBeenCalled()
  })

  it('无 workflow:read 权限（空角色）→ 403', async () => {
    // workflow:read 对全部 4 个合法角色开放，故用空角色触发默认拒绝
    mockCtx.mockResolvedValue({ userId: 'u1', orgId: 'o1', roles: [] } as never)
    expect((await GET()).status).toBe(403)
    expect(mockStats).not.toHaveBeenCalled()
  })

  it('有权限 → 200 且返回 stats', async () => {
    mockCtx.mockResolvedValue({ userId: 'u1', orgId: 'o1', roles: ['Developer'] } as never)
    mockStats.mockResolvedValue({ 'wf-a': { executions: 3, successRate: 67, lastRunAt: '2026-07-21T12:00:00Z' } })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stats: { 'wf-a': { executions: 3, successRate: 67, lastRunAt: '2026-07-21T12:00:00Z' } } })
    expect(mockStats).toHaveBeenCalledOnce()
  })
})
