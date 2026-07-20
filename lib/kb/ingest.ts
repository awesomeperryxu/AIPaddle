import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'
import type { RequestContext } from '@/lib/context'
import { embed } from '@/lib/ai'
import { replaceChunks } from '@/lib/data/chunks'
import {
  getDocumentStoragePath,
  downloadDocumentBytes,
  setDocumentStatus,
} from '@/lib/data/documents'

const CHUNK_SIZE = 800
const OVERLAP = 100

/** 按字符切块（含重叠）。生产可换按句/段，首版够用。 */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const step = CHUNK_SIZE - OVERLAP
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += step) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE))
    if (i + CHUNK_SIZE >= clean.length) break
  }
  return chunks
}

/** 从 PDF 字节提取纯文本（unpdf / pdfjs）。 */
export async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : text
}

/**
 * 向量化入库（4.2.2）：下载文件 → 提取文本 → 切块 → 调 lib/ai 嵌入(1536) → 写 chunks。
 * 状态流转 parsing→active；失败置 error 并记 error_msg。幂等（重灌覆盖旧块）。
 */
export async function ingestDocument(
  ctx: RequestContext,
  documentId: string,
): Promise<{ chunks: number }> {
  const storagePath = await getDocumentStoragePath(ctx, documentId)
  if (!storagePath) throw new Error('文档不存在或无权访问')

  await setDocumentStatus(ctx, documentId, 'parsing')
  try {
    const bytes = await downloadDocumentBytes(storagePath)
    const text = await extractPdfText(bytes)
    const parts = chunkText(text)

    if (parts.length === 0) {
      await setDocumentStatus(ctx, documentId, 'active')
      return { chunks: 0 }
    }

    const vectors = await embed(parts)
    const count = await replaceChunks(
      ctx,
      documentId,
      parts.map((content, i) => ({ content, metadata: { chunk_index: i }, embedding: vectors[i] })),
    )
    await setDocumentStatus(ctx, documentId, 'active')
    return { chunks: count }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await setDocumentStatus(ctx, documentId, 'error', msg)
    throw e
  }
}
