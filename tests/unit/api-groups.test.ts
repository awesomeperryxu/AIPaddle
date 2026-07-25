/**
 * 单元 · API /api/groups（4.1.21 / ADR-015）
 *   - 未登录 → 401
 *   - 建群参与者门控（服务端，不信前端）：非数字员工 + 越权 agent/team 剔除并回带 rejected，创建者自动入群
 *   - 发消息触发数字员工发言（mock 数字员工 /chat）：@定向 → 落库 assistant 消息标注 reason=mention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/group-chat', () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  addMessage: vi.fn(),
  listMessages: vi.fn(),
}))
vi.mock('@/lib/data/agents', () => ({ listAgents: vi.fn() }))
vi.mock('@/lib/data/digital-employee-teams', () => ({ listTeams: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ getAgentResources: vi.fn() }))
vi.mock('@/app/api/agents/[id]/chat/route', () => ({ POST: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { createGroup, getGroup, addMessage, listMessages } from '@/lib/data/group-chat'
import { listAgents } from '@/lib/data/agents'
import { listTeams } from '@/lib/data/digital-employee-teams'
import { getAgentResources } from '@/lib/data/agent-resources'
import { POST as agentChatPOST } from '@/app/api/agents/[id]/chat/route'
import { POST as createGroupPOST } from '@/app/api/groups/route'
import { POST as sendMessagePOST } from '@/app/api/groups/[id]/messages/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCreate = vi.mocked(createGroup)
const mockGetGroup = vi.mocked(getGroup)
const mockAdd = vi.mocked(addMessage)
const mockList = vi.mocked(listMessages)
const mockListAgents = vi.mocked(listAgents)
const mockListTeams = vi.mocked(listTeams)
const mockGetRes = vi.mocked(getAgentResources)
const mockChat = vi.mocked(agentChatPOST)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }

const DE = '11111111-1111-4111-8111-111111111111'        // 本租户数字员工 → 接受
const PLAIN = '22222222-2222-4222-8222-222222222222'     // 本租户非数字员工 → 拒
const FOREIGN = '33333333-3333-4333-8333-333333333333'   // 非本租户 agent → 拒
const TEAM = '44444444-4444-4444-8444-444444444444'      // 本租户团队 → 接受
const FTEAM = '55555555-5555-4555-8555-555555555555'     // 非本租户团队 → 拒
const GID = '66666666-6666-4666-8666-666666666666'

describe('POST /api/groups 建群参与者门控', () => {
  beforeEach(() => vi.clearAllMocks())
  const post = (b: unknown) => createGroupPOST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }))

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await post({ name: 'G' })).status).toBe(401)
  })

  it('越权/非数字员工成员剔除并回带 rejected，仅合法成员 + 创建者入群', async () => {
    mockCtx.mockResolvedValue(admin)
    mockListAgents.mockResolvedValue([{ id: DE, name: '客服Nova' }, { id: PLAIN, name: '普通助手' }] as never)
    mockListTeams.mockResolvedValue([{ id: TEAM, name: '售后团队' }] as never)
    mockGetRes.mockImplementation(async (_c, id) =>
      id === DE
        ? { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: ['x'] }
        : { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] },
    )
    mockCreate.mockResolvedValue({ id: GID, name: 'G', createdAt: '', updatedAt: '', participants: [], agentIds: [DE] })

    const res = await post({
      name: 'G',
      participants: [
        { type: 'agent', id: DE },
        { type: 'agent', id: PLAIN },
        { type: 'agent', id: FOREIGN },
        { type: 'team', id: TEAM },
        { type: 'team', id: FTEAM },
      ],
    })
    expect(res.status).toBe(201)
    // 仅合法成员 + 创建者透传给数据层
    expect(mockCreate).toHaveBeenCalledWith(admin, {
      name: 'G',
      participants: [
        { type: 'user', id: 'u1' },
        { type: 'agent', id: DE },
        { type: 'team', id: TEAM },
      ],
    })
    const body = await res.json()
    const rejectedIds = (body.rejected as { id: string }[]).map((r) => r.id).sort()
    expect(rejectedIds).toEqual([PLAIN, FOREIGN, FTEAM].sort())
  })
})

describe('POST /api/groups/[id]/messages 发消息触发发言', () => {
  beforeEach(() => vi.clearAllMocks())
  const params = { params: Promise.resolve({ id: GID }) }
  const post = (b: unknown) => sendMessagePOST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }), params)

  it('群不存在 → 404', async () => {
    mockCtx.mockResolvedValue(admin)
    mockGetGroup.mockResolvedValue(null)
    expect((await post({ content: 'hi' })).status).toBe(404)
  })

  it('@定向：调数字员工 /chat（mock）并落库 assistant 消息，标注 reason=mention', async () => {
    mockCtx.mockResolvedValue(admin)
    mockGetGroup.mockResolvedValue({ id: GID, name: 'G', createdAt: '', updatedAt: '', participants: [], agentIds: [DE] })
    mockListAgents.mockResolvedValue([{ id: DE, name: '客服Nova', description: '退款 售后', department: '' }] as never)
    mockList.mockResolvedValue([]) // 无历史 → 无冷却
    mockAdd.mockImplementation(async (_c, _g, m) => ({
      id: m.speakerType === 'agent' ? 'm-a' : 'm-h',
      role: m.role,
      content: m.content,
      speakerType: m.speakerType,
      speakerId: m.speakerId,
      reason: m.reason ?? null,
      createdAt: '2026-07-25T00:00:00Z',
    }))
    mockChat.mockResolvedValue(new Response(JSON.stringify({ reply: '好的，马上为您处理退款' }), { headers: { 'content-type': 'application/json' } }) as never)

    const res = await post({ content: '@客服Nova 帮我退款' })
    expect(res.status).toBe(201)
    // 数字员工 /chat 被调用（传该 agent id）
    expect(mockChat).toHaveBeenCalledTimes(1)
    // 两次落库：人类 + 数字员工回复
    expect(mockAdd).toHaveBeenCalledTimes(2)
    const body = await res.json()
    const agentMsg = (body.messages as { speakerType: string; reason: string; speakerId: string }[]).find((m) => m.speakerType === 'agent')
    expect(agentMsg).toBeTruthy()
    expect(agentMsg!.reason).toBe('mention')
    expect(agentMsg!.speakerId).toBe(DE)
  })

  it('无 @ 且无关键词命中 → 不触发发言，仅落库人类消息', async () => {
    mockCtx.mockResolvedValue(admin)
    mockGetGroup.mockResolvedValue({ id: GID, name: 'G', createdAt: '', updatedAt: '', participants: [], agentIds: [DE] })
    mockListAgents.mockResolvedValue([{ id: DE, name: '客服Nova', description: '退款 售后', department: '' }] as never)
    mockList.mockResolvedValue([])
    mockAdd.mockImplementation(async (_c, _g, m) => ({
      id: 'm-h', role: m.role, content: m.content, speakerType: m.speakerType, speakerId: m.speakerId, reason: m.reason ?? null, createdAt: '2026-07-25T00:00:00Z',
    }))

    const res = await post({ content: '今天天气不错' })
    expect(res.status).toBe(201)
    expect(mockChat).not.toHaveBeenCalled()
    expect(mockAdd).toHaveBeenCalledTimes(1)
  })
})
