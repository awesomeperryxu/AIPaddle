/**
 * L3 集成测试 · GET /api/audit（审计日志读取，4.1.3）
 *   1. 未登录 → 401
 *   2. 无 audit:read 权限（User）→ 403
 *   3. Admin/Auditor → 200 返回 { logs }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ listAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { listAudit } from '@/lib/data/audit'
import { GET } from '@/app/api/audit/route'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listAudit)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const auditorCtx: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }

const sampleLogs = [
  {
    id: 'a1',
    action: 'agent.approve',
    targetType: 'agent',
    targetId: 't1',
    detail: { decision: 'approved' },
    actorId: 'u1',
    actorName: '张三',
    ip: null,
    createdAt: '2026-07-27T10:00:00Z',
  },
]

function call() {
  return GET(new Request('http://localhost/api/audit'))
}

describe('GET /api/audit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call()).status).toBe(401)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('无权限：User → 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call()).status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('Admin → 200 返回 logs', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockList.mockResolvedValueOnce(sampleLogs)
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).logs).toEqual(sampleLogs)
    expect(mockList).toHaveBeenCalledWith(adminCtx, expect.any(Object))
  })

  it('Auditor → 200', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    mockList.mockResolvedValueOnce([])
    expect((await call()).status).toBe(200)
  })
})
