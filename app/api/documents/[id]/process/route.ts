import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { ingestDocument } from '@/lib/kb/ingest'

// POST /api/documents/[id]/process —— 解析/切块/向量化入库（4.2.2）
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：处理文档' } }, { status: 403 })
  }
  const { id } = await params
  try {
    const result = await ingestDocument(ctx, id)
    return Response.json({ ok: true, chunks: result.chunks })
  } catch (e) {
    return Response.json(
      { error: { code: 'ingest_failed', message: e instanceof Error ? e.message : '向量化失败' } },
      { status: 400 },
    )
  }
}
