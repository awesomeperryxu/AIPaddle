import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listDocuments, uploadDocument } from '@/lib/data/documents'
import { ensureDefaultKb } from '@/lib/data/knowledge'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

// GET /api/documents?kbId= —— 列出文档（RLS 隔离）
export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const kbId = new URL(request.url).searchParams.get('kbId') ?? undefined
  const documents = await listDocuments(ctx, kbId)
  return Response.json({ documents })
}

// POST /api/documents —— 上传文档（先只支持 PDF）。multipart：file[, kbId]
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：上传文档' } }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: { code: 'invalid', message: '缺少上传文件' } }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return Response.json({ error: { code: 'unsupported', message: '不支持的格式（仅 PDF）' } }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: { code: 'too_large', message: '超出大小限制（50MB）' } }, { status: 400 })
  }

  const kbIdRaw = String(formData?.get('kbId') ?? '').trim()
  const kbId = kbIdRaw || (await ensureDefaultKb(ctx))
  const bytes = await file.arrayBuffer()
  const doc = await uploadDocument(ctx, {
    kbId,
    filename: file.name,
    bytes,
    size: file.size,
    contentType: file.type,
  })
  return Response.json({ document: doc }, { status: 201 })
}
