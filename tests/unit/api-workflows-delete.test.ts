import { describe, it, expect, vi, beforeEach } from 'vitest'

// GX-5 补遗：DELETE /api/workflows/[id] —— workflow:delete 门控，软删透传。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/workflow', () => ({
  getWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}))
vi.mock('@/lib/workflow/validate', () => ({ validateGraph: vi.fn(() => []) }))
vi.mock('@/lib/workflow/validate-tools', () => ({ validateToolNodes: vi.fn(async () => []) }))

import { getRequestContext } from '@/lib/context'
import { deleteWorkflow } from '@/lib/data/workflow'
import { DELETE } from '@/app/api/workflows/[id]/route'

const mockCtx = vi.mocked(getRequestContext)
const mockDelete = vi.mocked(deleteWorkflow)

const params = Promise.resolve({ id: 'wf-1' })

describe('DELETE /api/workflows/[id]（GX-5 工作流软删）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await DELETE(new Request('http://x'), { params })
    expect(res.status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('无 workflow:delete 权限（User）→ 403', async () => {
    // workflow:delete 仅 Admin/Developer；User 触发默认拒绝
    mockCtx.mockResolvedValue({ userId: 'u1', orgId: 'o1', roles: ['User'] } as never)
    const res = await DELETE(new Request('http://x'), { params })
    expect(res.status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('有权限 → 透传 deleteWorkflow 并返回 { ok: true }', async () => {
    mockCtx.mockResolvedValue({ userId: 'u1', orgId: 'o1', roles: ['Developer'] } as never)
    mockDelete.mockResolvedValue(undefined)
    const res = await DELETE(new Request('http://x'), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledOnce()
    expect(mockDelete).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'wf-1')
  })
})
