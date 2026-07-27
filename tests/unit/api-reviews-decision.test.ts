/**
 * L3 集成测试 · POST /api/reviews/decision（安全审批裁决，4.1.3）
 *   1. 未登录 → 401
 *   2. 无 :review 权限（User）→ 403
 *   3. 合法裁决 → 200，透传 recordReviewDecision + 写审计
 *   4. 非法 decision → 400；缺 resourceId → 400
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/reviews', () => ({ recordReviewDecision: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { recordReviewDecision } from '@/lib/data/reviews'
import { writeAudit } from '@/lib/data/audit'
import { POST } from '@/app/api/reviews/decision/route'

const mockCtx = vi.mocked(getRequestContext)
const mockDecision = vi.mocked(recordReviewDecision)
const mockAudit = vi.mocked(writeAudit)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const auditorCtx: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const RID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'

function call(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/reviews/decision', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/reviews/decision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call({ resourceId: RID, decision: 'approved' })).status).toBe(401)
    expect(mockDecision).not.toHaveBeenCalled()
  })

  it('无权限：User 裁决 → 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call({ resourceId: RID, decision: 'approved' })).status).toBe(403)
    expect(mockDecision).not.toHaveBeenCalled()
  })

  it('非法 decision → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await call({ resourceId: RID, decision: 'maybe' })).status).toBe(400)
    expect(mockDecision).not.toHaveBeenCalled()
  })

  it('缺 resourceId → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await call({ decision: 'approved' })).status).toBe(400)
    expect(mockDecision).not.toHaveBeenCalled()
  })

  it('Admin approve（默认 agent 类型）→ 200，透传裁决 + 审计', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await call({ resourceId: RID, decision: 'approved', comments: 'ok' })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockDecision).toHaveBeenCalledWith(adminCtx, RID, 'approved', 'ok', 'agent')
    expect(mockAudit).toHaveBeenCalledWith(adminCtx, 'agent.approve', 'agent', RID, { decision: 'approved' })
  })

  it('Auditor reject skill → 200，按 skill:review 放行并透传类型', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    const res = await call({ resourceId: RID, decision: 'rejected', resourceType: 'skill' })
    expect(res.status).toBe(200)
    expect(mockDecision).toHaveBeenCalledWith(auditorCtx, RID, 'rejected', undefined, 'skill')
    expect(mockAudit).toHaveBeenCalledWith(auditorCtx, 'skill.reject', 'skill', RID, { decision: 'rejected' })
  })
})
