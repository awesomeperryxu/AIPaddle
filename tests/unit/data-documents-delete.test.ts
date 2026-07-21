import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.2.9：删文档必须同步软删其内容块，使 RAG 检索不再命中/引用已删文档。
// 本单测验证 deleteDocument 的接线（调用 deleteChunksByDocument 且传入正确 documentId）。

const { updateEq, maybeSingle, storageRemove } = vi.hoisted(() => ({
  updateEq: vi.fn().mockResolvedValue({ error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: { storage_path: 'org-1/doc.pdf' }, error: null }),
  storageRemove: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      // 取 storage_path：select().eq().is().maybeSingle()
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
      // 软删文档：update().eq()
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: { from: vi.fn().mockReturnValue({ remove: storageRemove }) },
  }),
}))

vi.mock('@/lib/data/chunks', () => ({
  deleteChunksByDocument: vi.fn().mockResolvedValue(undefined),
}))

import { deleteDocument } from '@/lib/data/documents'
import { deleteChunksByDocument } from '@/lib/data/chunks'

const ctx = { userId: 'u1', orgId: 'org-1', roles: ['Admin'] }

describe('deleteDocument 删除失效（4.2.9）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('删文档时同步软删其内容块', async () => {
    await deleteDocument(ctx as never, 'doc-123')
    expect(deleteChunksByDocument).toHaveBeenCalledTimes(1)
    expect(deleteChunksByDocument).toHaveBeenCalledWith(ctx, 'doc-123')
  })

  it('文档软删（写 deleted_at）与存储对象移除均被触发', async () => {
    await deleteDocument(ctx as never, 'doc-123')
    expect(updateEq).toHaveBeenCalled()
    expect(storageRemove).toHaveBeenCalledWith(['org-1/doc.pdf'])
  })
})
