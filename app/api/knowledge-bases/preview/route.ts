import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { extractTextFromFile, isSupportedDocExt } from '@/lib/office/extract'

// POST /api/knowledge-bases/preview  (multipart: file)
// BUG-78：创建向导「分段预览」对 PDF/Office 文件的真实内容抽取。
// 客户端无法解析 PDF/Office，故上传单个文件到服务端抽取纯文本（不落库、不建 KB），
// 仅返回截断文本供分段预览。复用 extractTextFromFile（pdf/office/text/html 统一分派）。
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'knowledge:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: { code: 'bad_request', message: '缺少文件' } }, { status: 400 })
  }
  if (!isSupportedDocExt(file.name)) {
    return Response.json({ error: { code: 'unsupported', message: '不支持的文件类型' } }, { status: 400 })
  }

  try {
    const bytes = await file.arrayBuffer()
    const text = await extractTextFromFile(file.name, bytes, { maxChars: 8000 })
    return Response.json({ text, filename: file.name })
  } catch (e) {
    return Response.json(
      { error: { code: 'extract_failed', message: e instanceof Error ? e.message : '解析失败' } },
      { status: 422 },
    )
  }
}
