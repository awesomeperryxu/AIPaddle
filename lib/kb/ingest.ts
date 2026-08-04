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

// 对齐 Dify 默认参数：1024 字符 / 50 重叠（原 800/100 偏小/偏大）
export type ChunkConfig = {
  chunkSize: number
  chunkOverlap: number
  separator: string
  removeUrls?: boolean  // 是否删除 URL 和电子邮件（JSONB 扩展字段，无迁移）
}
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { chunkSize: 800, chunkOverlap: 50, separator: '\n\n', removeUrls: false }

// BUG-91：切块只按字符数算，6MB PDF（嵌字体、文本 2000 字）只切 1 块，
// 向量被稀释（实测相似度 0.42 接近阈值 0.28）。
// 1536 维嵌入模型对超过 512 token 的文本分辨力显著下降，所以上限设 512。
const MAX_CHUNK_TOKENS = 512

/** 粗略估算 token 数 */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length
  const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, '')
  const words = (nonCjk.match(/[a-zA-Z0-9]+/g) ?? []).length
  return Math.ceil(cjk * 2 + words * 1.3)
}

/** 按句子边界拆超过 token 上限的块 */
function enforceTokenLimit(chunks: string[]): string[] {
  const result: string[] = []
  for (const chunk of chunks) {
    if (estimateTokens(chunk) <= MAX_CHUNK_TOKENS) { result.push(chunk); continue }
    const sentences = chunk.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
    let buf = ''
    for (const s of sentences) {
      if (estimateTokens(buf + s) > MAX_CHUNK_TOKENS && buf) {
        result.push(buf.trim())
        buf = ''
      }
      buf += s
    }
    if (buf.trim()) result.push(buf.trim())
  }
  return result
}

/** 规整切块参数：夹取合法区间，重叠恒小于长度，防跑飞/死循环。 */
export function normalizeChunkConfig(c?: Partial<ChunkConfig> | null): ChunkConfig {
  const chunkSize = Math.min(Math.max(Math.floor(c?.chunkSize ?? DEFAULT_CHUNK_CONFIG.chunkSize), 50), 4000)
  const overlapRaw = Math.max(Math.floor(c?.chunkOverlap ?? DEFAULT_CHUNK_CONFIG.chunkOverlap), 0)
  const chunkOverlap = Math.min(overlapRaw, chunkSize - 1)
  const separator = typeof c?.separator === 'string' ? c.separator : DEFAULT_CHUNK_CONFIG.separator
  const removeUrls = c?.removeUrls ?? false
  return { chunkSize, chunkOverlap, separator, removeUrls }
}

/**
 * 构建分隔符优先级链：用户选择的分隔符为首级，自动添加降级分隔符。
 * 对齐 Dify 的递归字符切分器（RecursiveCharacterTextSplitter）策略。
 */
function buildSepHierarchy(primarySep: string): string[] {
  if (!primarySep) return []  // 空分隔符 → 直接字符窗口回退
  if (primarySep === '\n\n') return ['\n\n', '\n']
  if (primarySep === '\n') return ['\n']
  return [primarySep, '\n\n', '\n']  // 自定义分隔符：先用自定义，再按段落/行降级
}

/**
 * 递归按分隔符层级切分，对齐 Dify 的多级 fallback 策略：
 * 先按 \n\n 切段落；段落仍超长则按 \n 切行；行仍超长则按字符窗口截断。
 * 避免从句子中间硬截断（原单级方案的问题）。
 */
function splitHierarchically(text: string, seps: string[], maxSize: number): string[] {
  if (!text.trim()) return []

  const [sep, ...rest] = seps

  // 无更细分隔符（或空分隔符）→ 字符滑动窗口兜底
  if (!sep) {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (!clean) return []
    if (clean.length <= maxSize) return [clean]
    const chunks: string[] = []
    for (let i = 0; i < clean.length; i += maxSize) {
      chunks.push(clean.slice(i, i + maxSize))
    }
    return chunks
  }

  // 先按当前分隔符切，保留原始换行（不预先折叠空白，避免破坏分隔符）
  const parts = text.split(sep).map(s => s.trim()).filter(Boolean)
  if (parts.length <= 1) {
    // 当前分隔符在文本中不存在 → 降级到下一个分隔符
    return splitHierarchically(text, rest, maxSize)
  }

  const result: string[] = []
  for (const part of parts) {
    const normalized = part.replace(/\s+/g, ' ').trim()
    if (!normalized) continue
    if (normalized.length <= maxSize) {
      result.push(normalized)
    } else {
      result.push(...splitHierarchically(part, rest, maxSize))
    }
  }
  return result
}

/**
 * 对齐 Dify 分段算法（RecursiveCharacterTextSplitter）：
 * 1. 可选预处理：删除 URL/邮件
 * 2. 多级分隔符递归切分（\n\n → \n → 字符），避免从句子中间截断
 * 3. 按 overlap 在相邻块间插入上文尾部，保持跨块语义连续性
 */
export function chunkText(text: string, config?: Partial<ChunkConfig> | null): string[] {
  const { chunkSize, chunkOverlap, separator, removeUrls } = normalizeChunkConfig(config)

  // 预处理
  let processed = text.replace(/\r\n/g, '\n')
  if (removeUrls) {
    processed = processed
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
  }

  // 递归切分
  const seps = buildSepHierarchy(separator)
  const rawSegments = splitHierarchically(processed, seps, chunkSize)

  if (rawSegments.length === 0) return []

  // BUG-91：在 overlap 之前按 token 上限拆
  const capped = enforceTokenLimit(rawSegments)

  if (chunkOverlap === 0) return capped

  // 在相邻块之间插入上一块的尾部作为 overlap，对齐 Dify 跨块上下文连续性
  const result: string[] = [capped[0]]
  for (let i = 1; i < capped.length; i++) {
    const prev = capped[i - 1]
    const curr = capped[i]
    const tail = prev.slice(-chunkOverlap)
    const withOverlap = (tail + ' ' + curr).trim().slice(0, chunkSize)
    result.push(withOverlap)
  }
  return result
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
