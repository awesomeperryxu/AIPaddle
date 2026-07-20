import 'server-only'
import type { RequestContext } from '@/lib/context'
import { chat } from '@/lib/ai'
import { extractPdfText } from '@/lib/kb/ingest'
import { generateFile, type OutputFormat } from './generate'
import { createClient } from '@/lib/supabase/server'

export type OfficeTask = 'summarize' | 'rewrite' | 'translate'

const TASK_PROMPT: Record<OfficeTask, string> = {
  summarize: '请把下面的文档内容总结为简洁的要点，分条列出。',
  rewrite: '请把下面的文档内容改写得更清晰、专业、通顺，保持原意。',
  translate: '请把下面的文档内容翻译成英文。',
}

/** 办公文件处理通道①（4.2.4）：解析(复用知识库管线)→AI 处理→生成 docx/xlsx/pdf→留审计。 */
export async function processOfficeFile(
  ctx: RequestContext,
  input: { bytes: ArrayBuffer; filename: string; task: OfficeTask; format: OutputFormat },
): Promise<{ bytes: Uint8Array; downloadName: string; contentType: string }> {
  const text = await extractPdfText(input.bytes)
  if (!text.trim()) throw new Error('无法从文件提取文本（仅支持含文本的 PDF）')

  const result = await chat(
    [
      { role: 'system', content: '你是办公文档处理助手，除翻译任务外用简体中文输出。' },
      { role: 'user', content: `${TASK_PROMPT[input.task]}\n\n文档内容：\n${text.slice(0, 12000)}` },
    ],
    { temperature: 0.3, maxTokens: 2048 },
  )

  const baseTitle = input.filename.replace(/\.[^.]+$/, '')
  const title = `${baseTitle}-${input.task}`
  const { bytes, contentType, ext } = await generateFile(input.format, title, result)

  // 审计（audit_logs 只插不改；请求级客户端 → RLS 保本租户）
  const supabase = await createClient()
  await supabase.from('audit_logs').insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    action: 'office.process',
    detail: { filename: input.filename, task: input.task, format: input.format },
  })

  return { bytes, downloadName: `${title}.${ext}`, contentType }
}
