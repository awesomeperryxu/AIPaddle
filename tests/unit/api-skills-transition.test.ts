/**
 * L3 集成测试 · app/api/skills/[id]/transition（Skill 上架审核打通，#51 Phase 1）
 *   - submit 中/高风险 → 建 skill 类型 pending 审批记录（平台管理员可审）
 *   - submit 低风险自动发布 → 不建审批记录
 *   - approve/reject → 更新该 skill 待审记录为 approved/rejected
 *   - 权限/非法流转/未登录 边界
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/skills', () => ({ transitionSkill: vi.fn(), submitSkill: vi.fn() }))
vi.mock('@/lib/data/reviews', () => ({ recordSubmission: vi.fn(), recordReviewDecision: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { transitionSkill, submitSkill } from '@/lib/data/skills'
import { recordSubmission, recordReviewDecision } from '@/lib/data/reviews'
import { writeAudit } from '@/lib/data/audit'
import { POST } from '@/app/api/skills/[id]/transition/route'

const mockCtx = vi.mocked(getRequestContext)
const mockSubmit = vi.mocked(submitSkill)
const mockTransition = vi.mocked(transitionSkill)
const mockRecordSubmission = vi.mocked(recordSubmission)
const mockRecordDecision = vi.mocked(recordReviewDecision)
const mockAudit = vi.mocked(writeAudit)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const devCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
const auditorCtx: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'

function call(action: string) {
  return POST(
    new Request(`http://localhost/api/skills/${ID}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id: ID }) },
  )
}

describe('POST /api/skills/[id]/transition（边界）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call('submit')).status).toBe(401)
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('未知动作 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await call('publish-now')).status).toBe(400)
  })

  it('无权限：User submit → 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call('submit')).status).toBe(403)
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('无权限：Developer 无 skill:review，approve → 403', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    expect((await call('approve')).status).toBe(403)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('目标不存在 → 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSubmit.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    expect((await call('submit')).status).toBe(404)
  })

  it('非法流转 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSubmit.mockResolvedValueOnce({ ok: false, reason: 'illegal' })
    expect((await call('submit')).status).toBe(409)
  })
})

describe('#51 Phase 1 · Skill 申请上架审核留痕', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submit 高风险（进 pending）→ 建 skill 类型待审记录 + 审计', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    mockSubmit.mockResolvedValueOnce({
      ok: true,
      auto: false,
      skill: { id: ID, status: 'pending', riskLevel: 'high' } as never,
    })
    const res = await call('submit')
    expect(res.status).toBe(200)
    expect((await res.json()).autoPublished).toBe(false)
    expect(mockRecordSubmission).toHaveBeenCalledWith(devCtx, ID, 'high', 'skill')
    expect(mockAudit).toHaveBeenCalledWith(devCtx, 'skill.submit', 'skill', ID, { to: 'pending', auto: false })
  })

  it('submit 低风险（自动发布）→ 不建审批记录', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    mockSubmit.mockResolvedValueOnce({
      ok: true,
      auto: true,
      skill: { id: ID, status: 'published', riskLevel: 'low' } as never,
    })
    const res = await call('submit')
    expect(res.status).toBe(200)
    expect((await res.json()).autoPublished).toBe(true)
    expect(mockRecordSubmission).not.toHaveBeenCalled()
  })

  it('approve → 该 skill 待审记录置 approved（type=skill）', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    mockTransition.mockResolvedValueOnce({ ok: true, skill: { id: ID, status: 'published' } as never })
    await call('approve')
    expect(mockRecordDecision).toHaveBeenCalledWith(auditorCtx, ID, 'approved', undefined, 'skill')
    expect(mockAudit).toHaveBeenCalledWith(auditorCtx, 'skill.approve', 'skill', ID, { to: 'published' })
  })

  it('reject → 该 skill 待审记录置 rejected', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    mockTransition.mockResolvedValueOnce({ ok: true, skill: { id: ID, status: 'draft' } as never })
    await call('reject')
    expect(mockRecordDecision).toHaveBeenCalledWith(auditorCtx, ID, 'rejected', undefined, 'skill')
  })

  it('approve 非法流转 → 不写审批/审计', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    mockTransition.mockResolvedValueOnce({ ok: false, reason: 'illegal' })
    await call('approve')
    expect(mockRecordDecision).not.toHaveBeenCalled()
    expect(mockAudit).not.toHaveBeenCalled()
  })
})
