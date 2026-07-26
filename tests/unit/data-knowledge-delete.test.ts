import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.2.9：删知识库必须连带软删其文档与内容块，使检索不再命中已删库。
// 本单测验证 deleteKnowledgeBase 的接线（逐文档 deleteChunksByDocument + 软删文档/库）。

const { docSelectIs, docUpdateEq, kbUpdateIs } = vi.hoisted(() => ({
  docSelectIs: vi.fn().mockResolvedValue({ data: [{ id: 'doc-1' }, { id: 'doc-2' }], error: null }),
  docUpdateEq: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ error: null }) }),
  kbUpdateIs: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'documents') {
        return {
          // select('id').eq('kb_id').is('deleted_at', null)
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: docSelectIs }) }),
          // update({deleted_at}).eq('kb_id')
          update: vi.fn().mockReturnValue({ eq: docUpdateEq }),
        }
      }
      // knowledge_bases: update().eq().is()
      return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: kbUpdateIs }) }) }
    }),
  }),
}))

vi.mock('@/lib/data/chunks', () => ({
  deleteChunksByDocument: vi.fn().mockResolvedValue(undefined),
}))

import { deleteKnowledgeBase } from '@/lib/data/knowledge'
import { deleteChunksByDocument } from '@/lib/data/chunks'

const ctx = { userId: 'u1', orgId: 'org-1', roles: ['Admin'] }

describe('deleteKnowledgeBase 连带失效（4.2.9）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('对库内每个文档失效其内容块', async () => {
    await deleteKnowledgeBase(ctx as never, 'kb-9')
    expect(deleteChunksByDocument).toHaveBeenCalledTimes(2)
    expect(deleteChunksByDocument).toHaveBeenCalledWith(ctx, 'doc-1')
    expect(deleteChunksByDocument).toHaveBeenCalledWith(ctx, 'doc-2')
  })

  it('软删文档与知识库本体均被触发', async () => {
    await deleteKnowledgeBase(ctx as never, 'kb-9')
    expect(docUpdateEq).toHaveBeenCalledWith('kb_id', 'kb-9')
    expect(kbUpdateIs).toHaveBeenCalled()
  })
})
