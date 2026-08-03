import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// 4.1.11：Agent 直挂资源 API（GET/PUT /api/agents/[id]/resources）

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ getAgentById: vi.fn(), listAgents: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ getAgentResources: vi.fn(), setAgentResources: vi.fn() }))

// GAP-1：绑定 Tool 时路由会查 tools 表校验发布状态。
// 默认返回空 → 传什么 id 都视作「未发布」，正是我们要断言被拒的场景。
let publishedTools: { id: string }[] = []
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        in: () => ({
          eq: () => ({
            eq: () => ({ is: async () => ({ data: table === 'tools' ? publishedTools : [] }) }),
            is: async () => ({ data: [] }),
          }),
        }),
      }),
    }),
  }),
}))

import { getRequestContext } from '@/lib/context'
import { getAgentById, listAgents } from '@/lib/data/agents'
import { getAgentResources, setAgentResources } from '@/lib/data/agent-resources'
import { GET, PUT } from '@/app/api/agents/[id]/resources/route'

const mockCtx = vi.mocked(getRequestContext)
const mockGetAgent = vi.mocked(getAgentById)
const mockListAgents = vi.mocked(listAgents)
const mockGetRes = vi.mocked(getAgentResources)
const mockSetRes = vi.mocked(setAgentResources)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const user: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'
const params = { params: Promise.resolve({ id: ID }) }

describe('GET /api/agents/[id]/resources', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://x'), params)).status).toBe(401)
  })

  it('Agent 不存在 → 404', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://x'), params)).status).toBe(404)
  })

  it('返回绑定资源', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    mockGetRes.mockResolvedValueOnce({ knowledgeBaseIds: ['k1'], skillIds: ['s1'] })
    const body = await (await GET(new Request('http://x'), params)).json()
    expect(body.resources).toEqual({ knowledgeBaseIds: ['k1'], skillIds: ['s1'] })
  })
})

describe('PUT /api/agents/[id]/resources', () => {
  beforeEach(() => vi.clearAllMocks())

  const put = (b: unknown) => PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(b) }), params)

  it('无权限（User）→ 403，不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(user)
    expect((await put({ knowledgeBaseIds: ['k1'] })).status).toBe(403)
    expect(mockSetRes).not.toHaveBeenCalled()
  })

  it('Admin 设置绑定 → 200 并透传给数据层', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    mockSetRes.mockResolvedValueOnce({ knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'], mcpServerIds: [], subAgentIds: [] })
    const res = await put({ knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'] })
    expect(res.status).toBe(200)
    expect(mockSetRes).toHaveBeenCalledWith(admin, ID, { knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'], mcpServerIds: [], subAgentIds: [], toolIds: []  })
  })
})

// 4.1.18 / ADR-014：子 Agent（数字员工）权限门控——授权集与数字员工判定在服务端
// V12-2.9 起：普通 Agent 入口不得提交 subAgentIds（D-08），
// 数字员工场景须显式声明 source='digital-employee'。本组测的是数字员工入口。
describe('PUT 子 Agent（数字员工）门控', () => {
  beforeEach(() => vi.clearAllMocks())

  const put = (b: unknown) => PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(b) }), params)
  // 有效 UUID 候选（数据层带 UUID 正则，非法 id 会被过滤）
  const SUB_OK = '11111111-1111-4111-8111-111111111111'   // 同租户、非数字员工 → 接受
  const SUB_FOREIGN = '22222222-2222-4222-8222-222222222222' // 不在授权集 → 拒（越权）
  const SUB_DE = '33333333-3333-4333-8333-333333333333'    // 本身是数字员工 → 拒（嵌套）

  it('越权（不在本租户授权集）与嵌套数字员工被拒，accepted 入库、rejected 回带', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    // 授权集 = 本租户 agents（含 SUB_OK 与 SUB_DE，但不含 SUB_FOREIGN）
    mockListAgents.mockResolvedValueOnce([{ id: SUB_OK }, { id: SUB_DE }] as never)
    // 数字员工判定：SUB_DE 自身引用了子 Agent → 是数字员工；其余不是
    mockGetRes.mockImplementation(async (_ctx, id) =>
      id === SUB_DE
        ? { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: ['x'] }
        : { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] },
    )
    mockSetRes.mockResolvedValueOnce({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [SUB_OK] })

    const res = await put({ source: 'digital-employee', subAgentIds: [SUB_OK, SUB_FOREIGN, SUB_DE] })
    expect(res.status).toBe(200)
    // 仅 accepted 透传给数据层
    expect(mockSetRes).toHaveBeenCalledWith(admin, ID, { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [SUB_OK], toolIds: []  })
    const body = await res.json()
    const rejectedIds = (body.subAgentRejected as { id: string }[]).map((r) => r.id).sort()
    expect(rejectedIds).toEqual([SUB_FOREIGN, SUB_DE].sort())
    expect(body.subAgentRejected).toHaveLength(2)
  })

  it('不能自引：把自己作为子 Agent 被拒', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    mockListAgents.mockResolvedValueOnce([{ id: ID }] as never)
    mockGetRes.mockResolvedValue({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] })
    mockSetRes.mockResolvedValueOnce({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] })

    const res = await put({ source: 'digital-employee', subAgentIds: [ID] })
    expect(res.status).toBe(200)
    expect(mockSetRes).toHaveBeenCalledWith(admin, ID, { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [], toolIds: []  })
    const body = await res.json()
    expect(body.subAgentRejected).toHaveLength(1)
    expect(body.subAgentRejected[0].id).toBe(ID)
  })
})


describe('PUT 绑定 Tool（GAP-1）', () => {
  beforeEach(() => { vi.clearAllMocks(); publishedTools = [] })

  const put = (body: unknown) =>
    PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify(body) }), params)

  it('🔴 绑定未发布的 Tool → 422，且不落库', async () => {
    // Tool 白名单就是用发布状态表达的（V12-4.2）。这里不拦，那套治理就形同虚设
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    const res = await put({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], toolIds: ['t-draft'] })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('tool_not_published')
    expect(mockSetRes).not.toHaveBeenCalled()
  })

  it('已发布的 Tool 正常透传给数据层', async () => {
    publishedTools = [{ id: 't-pub' }]
    mockCtx.mockResolvedValueOnce(admin)
    mockGetAgent.mockResolvedValueOnce({ id: ID } as never)
    mockSetRes.mockResolvedValueOnce({
      knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [], toolIds: ['t-pub'],
    })
    const res = await put({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], toolIds: ['t-pub'] })
    expect(res.status).toBe(200)
    expect(mockSetRes).toHaveBeenCalledWith(
      admin, ID,
      expect.objectContaining({ toolIds: ['t-pub'] }),
    )
  })
})
