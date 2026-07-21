import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.2.8：RAG 按可访问知识库范围检索——
// 通用问答只查全员可见 KB；无可访问 KB → searchChunks 收到空范围 → 拒答。

const { embedOne, chat, searchChunks, getDocumentFilenames, listAccessibleKbIds } = vi.hoisted(() => ({
  embedOne: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  chat: vi.fn().mockResolvedValue('答案 [1]'),
  searchChunks: vi.fn(),
  getDocumentFilenames: vi.fn().mockResolvedValue({ d1: '手册.pdf' }),
  listAccessibleKbIds: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({ embedOne, chat }))
vi.mock('@/lib/data/chunks', () => ({ searchChunks }))
vi.mock('@/lib/data/documents', () => ({ getDocumentFilenames }))
vi.mock('@/lib/data/knowledge', () => ({ listAccessibleKbIds }))

import { answerQuestion } from '@/lib/kb/rag'

const ctx = { userId: 'u1', orgId: 'org1', roles: ['User'] } as never

describe('RAG 权限范围（4.2.8）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('通用问答把「全员可见 KB」范围传给检索', async () => {
    listAccessibleKbIds.mockResolvedValue(['kb-org-1'])
    searchChunks.mockResolvedValue([
      { id: 'c1', documentId: 'd1', content: '相关内容', metadata: {}, similarity: 0.9 },
    ])
    const res = await answerQuestion(ctx, 'X1 保修多久？')
    // 未传 agentId → 走全员可见分支
    expect(listAccessibleKbIds).toHaveBeenCalledWith(ctx, { agentId: undefined })
    // 检索被限定在可访问 KB 范围
    expect(searchChunks).toHaveBeenCalledWith(ctx, expect.any(Array), expect.any(Number), ['kb-org-1'])
    expect(res.refused).toBe(false)
    expect(res.citations.length).toBeGreaterThan(0)
  })

  it('无可访问 KB（空范围）→ 检索空 → 拒答', async () => {
    listAccessibleKbIds.mockResolvedValue([])
    searchChunks.mockResolvedValue([]) // 空范围下检索层返回空
    const res = await answerQuestion(ctx, '任意问题')
    expect(searchChunks).toHaveBeenCalledWith(ctx, expect.any(Array), expect.any(Number), [])
    expect(res.refused).toBe(true)
    expect(res.citations).toHaveLength(0)
  })

  it('Agent 对话按其关联 KB 范围', async () => {
    listAccessibleKbIds.mockResolvedValue(['kb-agent-1'])
    searchChunks.mockResolvedValue([])
    await answerQuestion(ctx, '问题', { agentId: 'agent-9' })
    expect(listAccessibleKbIds).toHaveBeenCalledWith(ctx, { agentId: 'agent-9' })
  })
})
