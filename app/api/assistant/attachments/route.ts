import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { extractTextFromFile } from '@/lib/office/extract'
import type { Attachment } from '@/lib/assistant/attachments'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 单文件 10MB
const MAX_COUNT = 8 // 单条消息最多 8 个附件

// POST /api/assistant/attachments —— 个人助理消息附件（#55 · Block B/C）。
// multipart（多文件，字段名 files）：文档 → 解析成文本；图片 → base64 data URL。
// 不落库，仅作为本条消息上下文返回给前端，随下一条消息一并 POST。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:chat')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：使用助理' } }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const files = formData?.getAll('files').filter((f): f is File => f instanceof File) ?? []
  if (files.length === 0) {
    return Response.json({ error: { code: 'invalid', message: '缺少上传文件' } }, { status: 400 })
  }
  if (files.length > MAX_COUNT) {
    return Response.json({ error: { code: 'too_many', message: `附件数量超限（最多 ${MAX_COUNT} 个）` } }, { status: 400 })
  }

  const attachments: Attachment[] = []
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: { code: 'too_large', message: `「${file.name}」超出大小限制（10MB）` } }, { status: 400 })
    }
    const bytes = await file.arrayBuffer()
    if (file.type.startsWith('image/')) {
      const b64 = Buffer.from(bytes).toString('base64')
      attachments.push({ kind: 'image', filename: file.name, dataUrl: `data:${file.type};base64,${b64}` })
    } else {
      const text = await extractTextFromFile(file.name, bytes)
      attachments.push({ kind: 'doc', filename: file.name, text })
    }
  }

  return Response.json({ attachments })
}
