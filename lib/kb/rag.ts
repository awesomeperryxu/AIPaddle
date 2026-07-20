import 'server-only'
import type { RequestContext } from '@/lib/context'
import { embedOne, chat } from '@/lib/ai'
import { searchChunks } from '@/lib/data/chunks'
import { getDocumentFilenames } from '@/lib/data/documents'

// 相似度阈值：低于此值视为"检索不到"，触发拒答（金标准里有必须拒答的问题）。
const MIN_SIMILARITY = 0.28
const TOP_K = 5

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

const SYSTEM_PROMPT = `你是企业知识库问答助手。严格只依据下面「资料」中的内容回答用户问题，用简体中文简洁作答。
规则：
1. 资料中有明确答案 → 直接答，并在答案末尾用 [编号] 标注引用的资料条目（可多个）。
2. 资料中没有能回答该问题的信息 → 只回复"未找到相关信息"，绝不编造、绝不用常识补充。
3. 不要复述资料原文，用自己的话简洁概括。`

/**
 * RAG 问答（4.2.3）：嵌入问题 → 向量检索(RLS 隔离) → 相关块喂 qwen → 带引用作答；无相关块则拒答。
 */
export async function answerQuestion(ctx: RequestContext, question: string): Promise<RagAnswer> {
  const q = question.trim()
  if (!q) return { answer: '请输入问题。', citations: [], refused: true }

  const qEmbedding = await embedOne(q)
  const matches = await searchChunks(ctx, qEmbedding, TOP_K)
  const relevant = matches.filter((m) => m.similarity >= MIN_SIMILARITY)

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
