/**
 * 单元 · DE-7/DE-8 数字员工状态流转的两道闸
 *
 *   DE-7 发布门槛（AC-08b）：下级不可用时拒绝 approve / online，并指出是哪一个
 *   DE-8 下线联动（AC-08c）：下线被引用的 Agent → 409 + 受影响清单 → confirm 后连带下线
 *
 * 🔴 这两条守的是「静默跑不通」：不拦的话，数字员工显示已发布、调用才失败。
 * 线上 19 个数字员工里 16 个正处于这个状态。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ transitionAgent: vi.fn() }))
vi.mock('@/lib/data/digital-employee', () => ({ getDigitalEmployeeDetail: vi.fn() }))
vi.mock('@/lib/data/de-dependents', () => ({
  listDependentDigitalEmployees: vi.fn(),
  offlineDigitalEmployees: vi.fn(),
}))
vi.mock('@/lib/data/reviews', () => ({ recordSubmission: vi.fn(), recordReviewDecision: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { transitionAgent } from '@/lib/data/agents'
import { getDigitalEmployeeDetail } from '@/lib/data/digital-employee'
import { listDependentDigitalEmployees, offlineDigitalEmployees } from '@/lib/data/de-dependents'
import { POST } from '@/app/api/agents/[id]/transition/route'

const mockCtx = vi.mocked(getRequestContext)
const mockTransition = vi.mocked(transitionAgent)
const mockDetail = vi.mocked(getDigitalEmployeeDetail)
const mockDeps = vi.mocked(listDependentDigitalEmployees)
const mockOffline = vi.mocked(offlineDigitalEmployees)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const ID = '11111111-1111-4111-8111-111111111111'
const params = { params: Promise.resolve({ id: ID }) }

const post = (body: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
       { params: Promise.resolve({ id: ID }) })

const detail = (subAgents: unknown[], missing: string[] = []) => ({
  id: ID, name: '内容创作专家团', description: '', department: '', status: 'pending',
  subAgents, missingSubAgentIds: missing,
  createdByName: 'x', createdAt: '', updatedAt: '', origin: '用户自建', model: '',
}) as never

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(admin)
  mockTransition.mockResolvedValue({ ok: true, agent: { id: ID } } as never)
  mockDetail.mockResolvedValue(null)
  mockDeps.mockResolvedValue([])
  mockOffline.mockResolvedValue(0)
})

describe('DE-7 发布门槛', () => {
  it('下级全部已发布 → approve 放行', async () => {
    mockDetail.mockResolvedValue(detail([{ id: 'a1', name: '文博凯', status: 'published' }]))
    const res = await post({ action: 'approve' })
    expect(res.status).toBe(200)
    expect(mockTransition).toHaveBeenCalled()
  })

  it('下级是草稿 → 409，且错误信息点名是哪一个', async () => {
    mockDetail.mockResolvedValue(detail([{ id: 'a1', name: '律守正', status: 'draft' }]))
    const res = await post({ action: 'approve' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('sub_agent_not_ready')
    expect(body.error.message).toContain('律守正')
    // 🔴 必须没有真正流转——否则拦了个寂寞
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('下级已被删除 → 同样拦住', async () => {
    mockDetail.mockResolvedValue(detail([], ['gone-1']))
    const res = await post({ action: 'approve' })
    expect(res.status).toBe(409)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('online（重新上线）走同一道闸', async () => {
    mockDetail.mockResolvedValue(detail([{ id: 'a1', name: '律守正', status: 'offline' }]))
    const res = await post({ action: 'online' })
    expect(res.status).toBe(409)
  })

  it('submit / offline 不受门槛限制（否则草稿态的东西永远提交不了）', async () => {
    mockDetail.mockResolvedValue(detail([{ id: 'a1', name: '律守正', status: 'draft' }]))
    expect((await post({ action: 'submit' })).status).toBe(200)
  })

  it('普通 Agent（无下级）不受影响', async () => {
    mockDetail.mockResolvedValue(detail([]))
    const res = await post({ action: 'approve' })
    expect(res.status).toBe(200)
  })
})

describe('DE-8 下线联动', () => {
  it('无人引用 → 直接下线', async () => {
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(200)
    expect(mockOffline).not.toHaveBeenCalled()
  })

  it('有已发布的上级引用 → 409 + 受影响清单，且本体未下线', async () => {
    mockDeps.mockResolvedValue([{ id: 'de1', name: '内容创作专家团', status: 'published' }])
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('has_dependents')
    expect(body.affectedDigitalEmployees[0].name).toBe('内容创作专家团')
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('带 confirm=true → 本体下线 + 上级一并下线', async () => {
    mockDeps.mockResolvedValue([{ id: 'de1', name: '内容创作专家团', status: 'published' }])
    mockOffline.mockResolvedValue(1)
    const res = await post({ action: 'offline', confirm: true })
    expect(res.status).toBe(200)
    expect(mockOffline).toHaveBeenCalledWith(admin, ['de1'])
    expect((await res.json()).cascadedOffline).toBe(1)
  })

  it('🔴 只联动已发布的上级——草稿/已下线的上级不该被算进受影响清单', async () => {
    mockDeps.mockResolvedValue([
      { id: 'de1', name: '已发布团', status: 'published' },
      { id: 'de2', name: '草稿团', status: 'draft' },
    ])
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.affectedDigitalEmployees).toHaveLength(1)
    expect(body.affectedDigitalEmployees[0].id).toBe('de1')
  })

  it('联动发生在本体流转成功之后（避免"上级下了、自己没下"的错位）', async () => {
    mockDeps.mockResolvedValue([{ id: 'de1', name: 'T', status: 'published' }])
    mockTransition.mockResolvedValue({ ok: false, reason: 'illegal' } as never)
    const res = await post({ action: 'offline', confirm: true })
    expect(res.status).toBe(409)
    expect(mockOffline).not.toHaveBeenCalled()
  })
})
