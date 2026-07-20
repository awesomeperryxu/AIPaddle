import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { processOfficeFile, type OfficeTask } from '@/lib/office/process'
import type { OutputFormat } from '@/lib/office/generate'

const TASKS = ['summarize', 'rewrite', 'translate']
const FORMATS = ['docx', 'xlsx', 'pdf']
const MAX = 20 * 1024 * 1024

// POST /api/office/process —— 上传→AI处理→生成→下载（4.2.4）。multipart: file, task, format
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }

  const fd = await request.formData().catch(() => null)
  const file = fd?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: { code: 'invalid', message: '缺少文件' } }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return Response.json({ error: { code: 'unsupported', message: '当前仅支持 PDF 输入' } }, { status: 400 })
  }
  if (file.size > MAX) {
    return Response.json({ error: { code: 'too_large', message: '超出大小限制' } }, { status: 400 })
  }
  const task = String(fd?.get('task') ?? 'summarize')
  const format = String(fd?.get('format') ?? 'docx')
  if (!TASKS.includes(task)) return Response.json({ error: { code: 'invalid', message: '不支持的处理类型' } }, { status: 400 })
  if (!FORMATS.includes(format)) return Response.json({ error: { code: 'invalid', message: '不支持的输出格式' } }, { status: 400 })

  try {
    const bytes = await file.arrayBuffer()
    const { bytes: out, downloadName, contentType } = await processOfficeFile(ctx, {
      bytes,
      filename: file.name,
      task: task as OfficeTask,
      format: format as OutputFormat,
    })
    return new Response(out as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      },
    })
  } catch (e) {
    return Response.json(
      { error: { code: 'process_failed', message: e instanceof Error ? e.message : '处理失败' } },
      { status: 400 },
    )
  }
}
