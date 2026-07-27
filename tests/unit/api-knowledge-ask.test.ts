import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// BUG-79：知识库问答透传 kbId + 检索参数；非法参数忽略；保持 knowledge:read 门控。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/permissions', () => ({ can: vi.fn(() => true) }))
vi.mock('@/lib/kb/rag', () => ({
  answerQuestion: vi.fn().mockResolvedValue({ answer: '答案', citations: [], refused: false }),
}))

import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { answerQuestion } from '@/lib/kb/rag'
import { POST } from '@/app/api/knowledge/ask/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCan = vi.mocked(can)
const mockAnswer = vi.mocked(answerQuestion)

const user: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['User'] }

function req(body: unknown): Request {
  return { json: async () => body } as unknown as Request
}

describe('POST /api/knowledge/ask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockReturnValue(true)
  })

  it('未登录 → 401，不问答', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await POST(req({ question: 'x' }))).status).toBe(401)
    expect(mockAnswer).not.toHaveBeenCalled()
  })

  it('无 knowledge:read → 403，不问答', async () => {
    mockCtx.mockResolvedValueOnce(user)
    mockCan.mockReturnValueOnce(false)
    expect((await POST(req({ question: 'x' }))).status).toBe(403)
    expect(mockAnswer).not.toHaveBeenCalled()
  })

  it('空问题 → 400', async () => {
    mockCtx.mockResolvedValueOnce(user)
    expect((await POST(req({ question: '  ' }))).status).toBe(400)
    expect(mockAnswer).not.toHaveBeenCalled()
  })

  it('透传 kbId / topK / scoreThreshold', async () => {
    mockCtx.mockResolvedValueOnce(user)
    const res = await POST(req({ question: '年假政策', kbId: 'kb-1', topK: 8, scoreThreshold: 0.5 }))
    expect(res.status).toBe(200)
    expect(mockAnswer).toHaveBeenCalledWith(user, '年假政策', {
      kbId: 'kb-1',
      topK: 8,
      scoreThreshold: 0.5,
    })
  })

  it('空 kbId 归一为 undefined（全部知识库）', async () => {
    mockCtx.mockResolvedValueOnce(user)
    await POST(req({ question: 'x', kbId: '' }))
    expect(mockAnswer).toHaveBeenCalledWith(user, 'x', {
      kbId: undefined,
      topK: undefined,
      scoreThreshold: undefined,
    })
  })

  it('非法 topK（越界/非整数）与非法 scoreThreshold（越界）被忽略', async () => {
    mockCtx.mockResolvedValueOnce(user)
    await POST(req({ question: 'x', topK: 99, scoreThreshold: 2 }))
    expect(mockAnswer).toHaveBeenCalledWith(user, 'x', {
      kbId: undefined,
      topK: undefined,
      scoreThreshold: undefined,
    })

    mockCtx.mockResolvedValueOnce(user)
    await POST(req({ question: 'x', topK: 3.5, scoreThreshold: -0.1 }))
    expect(mockAnswer).toHaveBeenLastCalledWith(user, 'x', {
      kbId: undefined,
      topK: undefined,
      scoreThreshold: undefined,
    })
  })
})
