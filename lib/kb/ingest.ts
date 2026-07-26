import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'
import type { RequestContext } from '@/lib/context'
import { embed } from '@/lib/ai'
import { replaceChunks } from '@/lib/data/chunks'
import {
  getDocumentStoragePath,
  downloadDocumentBytes,
  setDocumentStatus,
  getDocumentFilenames,
  getDocumentKbId,
} from '@/lib/data/documents'
import { getKbChunkConfig } from '@/lib/data/knowledge'
import { extractTextFromFile } from '@/lib/office/extract'

// 知识库入库不截断（大文档全量切块）；给个大上限防跑飞（约 30 万字）。
const KB_MAX_CHARS = 300000

// 4.2.7：切块参数可配（原 800/100 硬编码）。默认与历史一致。
export type ChunkConfig = { chunkSize: number; chunkOverlap: number; separator: string }
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { chunkSize: 800, chunkOverlap: 100, separator: '\n\n' }

/** 规整切块参数：夹取合法区间，重叠恒小于长度，防跑飞/死循环。 */
export function normalizeChunkConfig(c?: Partial<ChunkConfig> | null): ChunkConfig {
  const chunkSize = Math.min(Math.max(Math.floor(c?.chunkSize ?? DEFAULT_CHUNK_CONFIG.chunkSize), 50), 4000)
  const overlapRaw = Math.max(Math.floor(c?.chunkOverlap ?? DEFAULT_CHUNK_CONFIG.chunkOverlap), 0)
  const chunkOverlap = Math.min(overlapRaw, chunkSize - 1)
  const separator = typeof c?.separator === 'string' ? c.separator : DEFAULT_CHUNK_CONFIG.separator
  return { chunkSize, chunkOverlap, separator }
}

/**
 * 按分隔符 + 字符窗口切块（含重叠）。
 * 有分隔符时先切成语义段（块不跨段），每段内用 size/overlap 窗口；无分隔符时整体切窗口。
 */
export function chunkText(text: string, config?: Partial<ChunkConfig> | null): string[] {
  const { chunkSize, chunkOverlap, separator } = normalizeChunkConfig(config)
  const step = chunkSize - chunkOverlap
  const segments = separator ? text.split(separator) : [text]
  const chunks: string[] = []
  for (const seg of segments) {
    const clean = seg.replace(/\s+/g, ' ').trim()
    if (!clean) continue
    for (let i = 0; i < clean.length; i += step) {
      chunks.push(clean.slice(i, i + chunkSize))
      if (i + chunkSize >= clean.length) break
    }
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
    // 4.2.6：多格式解析（PDF/Word/Excel/PPT/TXT/MD/HTML…），按文件名扩展名分派。
    const filenames = await getDocumentFilenames(ctx, [documentId])
    const filename = filenames[documentId] ?? storagePath
    const text = await extractTextFromFile(filename, bytes, { maxChars: KB_MAX_CHARS })
    // 4.2.7：按知识库配置的切块参数切块（缺省回落 800/100）。
    const kbId = await getDocumentKbId(ctx, documentId)
    const chunkConfig = kbId ? await getKbChunkConfig(ctx, kbId) : undefined
    const parts = chunkText(text, chunkConfig)

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
