import { describe, it, expect, vi, beforeEach } from 'vitest'

// 个人助理会话 API（切片1）：鉴权 + 列表/新建。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/conversations', () => ({
  listConversations: vi.fn().mockResolvedValue([{ id: 'c1', title: '新对话', createdAt: '', updatedAt: '' }]),
  createConversation: vi.fn().mockResolvedValue({ id: 'c2', title: '新对话', createdAt: '', updatedAt: '' }),
}))

import { getRequestContext } from '@/lib/context'
import { listConversations, createConversation } from '@/lib/data/conversations'
import { GET, POST } from '@/app/api/assistant/conversations/route'

const mockCtx = vi.mocked(getRequestContext)
const ctx = { userId: 'u1', orgId: 'o1', roles: ['User'] as const }
const postReq = (b: unknown) =>
  new Request('http://localhost/api/assistant/conversations', { method: 'POST', body: JSON.stringify(b) })

describe('个人助理会话 API（切片1）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await POST(postReq({}))).status).toBe(401)
  })

  it('GET → 返回本人会话列表', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversations).toHaveLength(1)
    expect(vi.mocked(listConversations)).toHaveBeenCalledWith(ctx)
  })

  it('POST → 新建会话 201', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    const res = await POST(postReq({ title: '工作助手' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.conversation.id).toBe('c2')
    expect(vi.mocked(createConversation)).toHaveBeenCalledWith(ctx, '工作助手')
  })
})
