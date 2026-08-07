/**
 * 单元 · API /api/teams（4.1.19 / ADR-014）
 *   - POST 创建：权限 agent:create（User → 403，Admin → 201）
 *   - PATCH 成员门控（服务端，不信前端）：越权者剔除；DE-10 起数字员工与普通 Agent 并级，均可入团队
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/digital-employee-teams', () => ({
  listTeams: vi.fn(),
  createTeam: vi.fn(),
  getTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}))
vi.mock('@/lib/data/agents', () => ({ listAgents: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ getAgentResources: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { createTeam, getTeam, updateTeam } from '@/lib/data/digital-employee-teams'
import { listAgents } from '@/lib/data/agents'
import { getAgentResources } from '@/lib/data/agent-resources'
import { POST } from '@/app/api/teams/route'
import { PATCH } from '@/app/api/teams/[id]/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCreate = vi.mocked(createTeam)
const mockGetTeam = vi.mocked(getTeam)
const mockUpdate = vi.mocked(updateTeam)
const mockListAgents = vi.mocked(listAgents)
const mockGetRes = vi.mocked(getAgentResources)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const user: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }
const TEAM_ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'
const params = { params: Promise.resolve({ id: TEAM_ID }) }

const DE = '11111111-1111-4111-8111-111111111111'      // 本租户 + 是数字员工 → 接受
const PLAIN = '22222222-2222-4222-8222-222222222222'   // 本租户 + 非数字员工 → 拒
const FOREIGN = '33333333-3333-4333-8333-333333333333' // 不在本租户授权集 → 拒（越权）

describe('POST /api/teams 创建', () => {
  beforeEach(() => vi.clearAllMocks())
  const post = (b: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }))

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await post({ name: 'T' })).status).toBe(401)
  })

  it('无权限（User）→ 403，不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(user)
    expect((await post({ name: 'T' })).status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('名称为空 → 400', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    expect((await post({ name: '  ' })).status).toBe(400)
  })

  it('Admin 创建 → 201', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockCreate.mockResolvedValueOnce({ id: TEAM_ID, name: 'T', description: '', status: 'draft', memberIds: [], updatedAt: '2026-07-25' })
    const res = await post({ name: 'T' })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(admin, { name: 'T' })
  })
})

describe('PATCH /api/teams/[id] 成员门控', () => {
  beforeEach(() => vi.clearAllMocks())
  const patch = (b: unknown) => PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(b) }), params)

  // 🔴 DE-10（2026-08-07，D-12 放宽 / ADR-026 §1）：成员**可以是数字员工，
  // 也可以是普通 Agent，两者在团队 Workflow 中并级**。
  // 原用例断言「普通 Agent 被拒」，那是放宽前的规则，已随本次改动作废。
  // 仍要拦住的只有「不是本租户 / 无权使用」。
  it('普通 Agent 现在可以入团队；只有越权者被拒', async () => {
    mockCtx.mockResolvedValue(admin)
    mockGetTeam.mockResolvedValue({ id: TEAM_ID, name: 'T', description: '', status: 'draft', memberIds: [], updatedAt: '2026-07-25' })
    // 授权集 = 本租户 Agent（含 DE、PLAIN，不含 FOREIGN）
    mockListAgents.mockResolvedValue([{ id: DE, name: '客服数字员工' }, { id: PLAIN, name: '普通 Agent' }] as never)
    mockUpdate.mockResolvedValue({ id: TEAM_ID, name: 'T', description: '', status: 'draft', memberIds: [DE, PLAIN], updatedAt: '2026-07-25' })

    const res = await patch({ memberIds: [DE, PLAIN, FOREIGN] })
    expect(res.status).toBe(200)
    // 数字员工与普通 Agent 都入库，越权者不入
    expect(mockUpdate).toHaveBeenCalledWith(admin, TEAM_ID, expect.objectContaining({ memberIds: [DE, PLAIN] }))
    const body = await res.json()
    const rejectedIds = (body.rejected as { id: string }[]).map((r) => r.id)
    expect(rejectedIds).toEqual([FOREIGN])
    const reason = (body.rejected as { id: string; reason: string }[]).find((r) => r.id === FOREIGN)!.reason
    expect(reason).toMatch(/不是本租户|无权使用/)
  })

  it('无权限（User）→ 403，不触碰数据层', async () => {
    mockCtx.mockResolvedValue(user)
    const res = await patch({ memberIds: [DE] })
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('团队不存在 → 404', async () => {
    mockCtx.mockResolvedValue(admin)
    mockGetTeam.mockResolvedValue(null)
    expect((await patch({ memberIds: [DE] })).status).toBe(404)
  })
})
