/**
 * 单元 · API /api/digital-employees（4.1.20 / ADR-014）
 *   @@ 唤醒候选：只返回本租户「数字员工」（引用了子 Agent 的 Agent）+「数字员工团队」。
 *   - 未登录 → 401（读端点对齐 GET /api/agents：登录即可读，RLS 隔离本租户）
 *   - 正常：employees 仅含数字员工（普通 Agent 被过滤），teams 全量返回
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ listAgents: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ listDigitalEmployeeIds: vi.fn() }))
vi.mock('@/lib/data/digital-employee-teams', () => ({ listTeams: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { listTeams } from '@/lib/data/digital-employee-teams'
import { GET } from '@/app/api/digital-employees/route'

const mockCtx = vi.mocked(getRequestContext)
const mockListAgents = vi.mocked(listAgents)
const mockListDeIds = vi.mocked(listDigitalEmployeeIds)
const mockListTeams = vi.mocked(listTeams)

const user: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['User'] }

const DE = '11111111-1111-4111-8111-111111111111'      // 数字员工
const PLAIN = '22222222-2222-4222-8222-222222222222'   // 普通 Agent（应被过滤）
const TEAM = '33333333-3333-4333-8333-333333333333'

describe('GET /api/digital-employees', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401，不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
    expect(mockListAgents).not.toHaveBeenCalled()
  })

  it('只返回数字员工 + 团队（普通 Agent 被过滤）', async () => {
    mockCtx.mockResolvedValueOnce(user)
    mockListAgents.mockResolvedValueOnce([
      { id: DE, name: '客服Nova' },
      { id: PLAIN, name: '普通助手' },
    ] as never)
    mockListDeIds.mockResolvedValueOnce([DE])
    mockListTeams.mockResolvedValueOnce([
      { id: TEAM, name: '售后团队', description: '', status: 'published', memberIds: [DE], updatedAt: '2026-07-25' },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.employees).toEqual([{ id: DE, name: '客服Nova' }])
    expect(body.teams).toEqual([{ id: TEAM, name: '售后团队' }])
  })
})
