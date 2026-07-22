import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// 4.1.11：Agent 直挂资源 API（GET/PUT /api/agents/[id]/resources）

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ getAgentById: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ getAgentResources: vi.fn(), setAgentResources: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { getAgentById } from '@/lib/data/agents'
import { getAgentResources, setAgentResources } from '@/lib/data/agent-resources'
import { GET, PUT } from '@/app/api/agents/[id]/resources/route'

const mockCtx = vi.mocked(getRequestContext)
const mockGetAgent = vi.mocked(getAgentById)
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
    mockSetRes.mockResolvedValueOnce({ knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'] })
    const res = await put({ knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'] })
    expect(res.status).toBe(200)
    expect(mockSetRes).toHaveBeenCalledWith(admin, ID, { knowledgeBaseIds: ['k1'], skillIds: ['s1', 's2'] })
  })
})
