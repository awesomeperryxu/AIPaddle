import 'server-only'
import type { RequestContext } from '@/lib/context'
import { embedOne, chat } from '@/lib/ai'
import { searchChunks } from '@/lib/data/chunks'
import { getDocumentFilenames } from '@/lib/data/documents'
import { getKbRetrievalConfig, listAccessibleKbIds, DEFAULT_KB_RETRIEVAL_CONFIG } from '@/lib/data/knowledge'

// 相似度阈值/topK 默认值（原硬编码；4.2.8 起改为按 KB 配置，缺省回落这里）。
const MIN_SIMILARITY = DEFAULT_KB_RETRIEVAL_CONFIG.scoreThreshold
const TOP_K = DEFAULT_KB_RETRIEVAL_CONFIG.topK

// BUG-92：多库检索时单库的高相似度结果会把其他库完全挤掉。
// 改为按库分组取 topK 后再合并排序，每库至少保底 ceil(topK / 库数) 条。
import type { MatchedChunk } from '@/lib/data/chunks'

async function searchPerKb(
  ctx: RequestContext,
  qEmbedding: number[],
  topK: number,
  kbIds: string[],
): Promise<MatchedChunk[]> {
  if (kbIds.length <= 1) return searchChunks(ctx, qEmbedding, topK, kbIds)
  const perKb = Math.max(Math.ceil(topK / kbIds.length), 2)
  const all = await Promise.all(
    kbIds.map((id) => searchChunks(ctx, qEmbedding, perKb, [id])),
  )
  return all.flat().sort((a, b) => b.similarity - a.similarity).slice(0, topK)
}

export type Citation = {
  documentId: string
  filename: string
  snippet: string
  similarity: number
}
export type RagAnswer = {
  answer: string
  citations: Citation[]
  refused: boolean
}

export type RetrievedSegment = {
  documentId: string
  filename: string
  snippet: string
  similarity: number
}

/**
 * 检索测试（4.2.5）：只做嵌入 + 向量检索，返回召回分段与相关性评分（不调用 LLM 生成）。
 * kbId 传入 → 仅在该知识库内检索；否则按可访问范围（全员可见）。按相似度降序。
 */
export async function retrieveSegments(
  ctx: RequestContext,
  question: string,
  opts?: { kbId?: string; topK?: number; scoreThreshold?: number; agentId?: string },
): Promise<RetrievedSegment[]> {
  const q = question.trim()
  if (!q) return []
  // 优先单 kbId；否则按 agentId 取该 Agent 直挂的知识库（4.1.11）；再否则全员可见。
  const kbIds = opts?.kbId
    ? [opts.kbId]
    : opts?.agentId
      ? await listAccessibleKbIds(ctx, { agentId: opts.agentId })
      : await listAccessibleKbIds(ctx)
  if (kbIds.length === 0) return []
  // 4.2.8：单库时读该库检索配置；显式 opts 覆盖（命中测试调参用）。多库回落默认。
  const kbConfig = opts?.kbId ? await getKbRetrievalConfig(ctx, opts.kbId) : null
  const topK = opts?.topK ?? kbConfig?.topK ?? TOP_K
  const threshold = opts?.scoreThreshold ?? kbConfig?.scoreThreshold ?? MIN_SIMILARITY
  const qEmbedding = await embedOne(q)
  const matches = await searchPerKb(ctx, qEmbedding, topK, kbIds)
  const passed = matches.filter((m) => m.similarity >= threshold)
  if (passed.length === 0) return []
  const filenames = await getDocumentFilenames(
    ctx,
    [...new Set(passed.map((m) => m.documentId))],
  )
  return passed
    .map((m) => ({
      documentId: m.documentId,
      filename: filenames[m.documentId] ?? '文档',
      snippet: m.content.slice(0, 160),
      similarity: Math.round(m.similarity * 1000) / 1000,
    }))
    .sort((a, b) => b.similarity - a.similarity)
}

const SYSTEM_PROMPT = `你是企业知识库问答助手。严格只依据下面「资料」中的内容回答用户问题，用简体中文简洁作答。
规则：
1. 资料中有明确答案 → 直接答，并在答案末尾用 [编号] 标注引用的资料条目（可多个）。
2. 资料中没有能回答该问题的信息 → 只回复"未找到相关信息"，绝不编造、绝不用常识补充。
3. 不要复述资料原文，用自己的话简洁概括。`

/**
 * RAG 问答（4.2.3 / 4.2.8）：嵌入问题 → 按可访问知识库范围向量检索 → 相关块喂 qwen → 带引用作答；无相关块则拒答。
 * opts.agentId 传入（Agent 对话）→ 仅检索该 Agent 关联的知识库；
 * 不传（通用问答）→ 仅检索全员可见（visibility='org'）的知识库。
 * opts.kbId 传入 → 仅在该库检索，但须落在可访问范围内（越权/不存在则拒答，绝不检索他库他租户）。
 * opts.topK / opts.scoreThreshold 传入 → 覆盖库配置/默认值。
 */
export async function answerQuestion(
  ctx: RequestContext,
  question: string,
  opts?: { agentId?: string; kbId?: string; topK?: number; scoreThreshold?: number },
): Promise<RagAnswer> {
  const q = question.trim()
  if (!q) return { answer: '请输入问题。', citations: [], refused: true }

  const accessible = await listAccessibleKbIds(ctx, { agentId: opts?.agentId })
  // 越权防护：指定 kbId 时必须落在可访问范围内，否则拒答（不越权检索他库/他租户）。
  let kbIds = accessible
  if (opts?.kbId) {
    if (!accessible.includes(opts.kbId)) {
      return { answer: '未找到相关信息。', citations: [], refused: true }
    }
    kbIds = [opts.kbId]
  }
  // 4.2.8：单库时按其检索配置；多库/空范围回落默认。显式 opts 覆盖优先。
  const cfg = kbIds.length === 1 ? await getKbRetrievalConfig(ctx, kbIds[0]) : null
  const topK = opts?.topK ?? cfg?.topK ?? TOP_K
  const threshold = opts?.scoreThreshold ?? cfg?.scoreThreshold ?? MIN_SIMILARITY
  const qEmbedding = await embedOne(q)
  const matches = await searchPerKb(ctx, qEmbedding, topK, kbIds)
  const relevant = matches.filter((m) => m.similarity >= threshold)

  if (relevant.length === 0) {
    return { answer: '未找到相关信息。', citations: [], refused: true }
  }

  const filenames = await getDocumentFilenames(
    ctx,
    [...new Set(relevant.map((m) => m.documentId))],
  )

  const context = relevant
    .map((m, i) => `[${i + 1}] 来源《${filenames[m.documentId] ?? '文档'}》：\n${m.content}`)
    .join('\n\n')

  const answer = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `资料：\n${context}\n\n问题：${q}` },
    ],
    { temperature: 0.2, maxTokens: 512 },
  )

  const refused = /未找到相关信息/.test(answer)
  return {
    answer,
    citations: refused
      ? []
      : relevant.map((m) => ({
          documentId: m.documentId,
          filename: filenames[m.documentId] ?? '文档',
          snippet: m.content.slice(0, 120),
          similarity: Math.round(m.similarity * 1000) / 1000,
        })),
    refused,
  }
}
