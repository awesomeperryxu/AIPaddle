import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { deleteDocument } from '@/lib/data/documents'

// DELETE /api/documents/[id] —— 软删除文档 + 移除存储对象
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除文档' } }, { status: 403 })
  }
  const { id } = await params
  try {
    await deleteDocument(ctx, id)
  } catch (e) {
    return Response.json(
      { error: { code: 'delete_failed', message: e instanceof Error ? e.message : '删除失败' } },
      { status: 400 },
    )
  }
  return Response.json({ ok: true })
}
