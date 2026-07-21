import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 内容块数据层（ADR-008）：请求级客户端 + RLS，按租户隔离。
// embedding 存 pgvector(1536)，插入时格式化为 '[v0,v1,...]' 字符串（pgvector 接受）。
export type ChunkInput = {
  content: string
  metadata: Record<string, unknown>
  embedding: number[]
}

/** 重灌某文档的内容块：先软删旧块，再插新块（幂等，供重复向量化）。 */
export async function replaceChunks(
  ctx: RequestContext,
  documentId: string,
  items: ChunkInput[],
): Promise<number> {
  const supabase = await createClient()
  await supabase
    .from('chunks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('document_id', documentId)
    .is('deleted_at', null)

  if (items.length === 0) return 0
  const rows = items.map((it) => ({
    org_id: ctx.orgId,
    document_id: documentId,
    content: it.content,
    metadata: it.metadata,
    embedding: `[${it.embedding.join(',')}]`,
  }))
  const { error } = await supabase.from('chunks').insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

/** 软删某文档的全部内容块（4.2.9：删文档时同步失效其向量块，RAG 不再检索/引用）。 */
export async function deleteChunksByDocument(
  _ctx: RequestContext,
  documentId: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('chunks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('document_id', documentId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

export type MatchedChunk = {
  id: string
  documentId: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

/**
 * 向量检索（4.2.3 / 4.2.8）：调 match_chunks RPC，请求级客户端 → RLS 只返回本租户块。
 * kbIds 传入时按可访问知识库范围过滤（4.2.8）：
 * - undefined → 不过滤（全租户范围，向后兼容）
 * - [] 空数组 → 无可访问 KB，直接返回空（不检索）
 */
export async function searchChunks(
  _ctx: RequestContext,
  queryEmbedding: number[],
  topK = 5,
  kbIds?: string[],
): Promise<MatchedChunk[]> {
  if (kbIds && kbIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_count: topK,
    filter_kb_ids: kbIds ?? null,
  })
  if (error) throw new Error(error.message)
  return ((data as {
    id: string
    document_id: string
    content: string
    metadata: Record<string, unknown>
    similarity: number
  }[] | null) ?? []).map((r) => ({
    id: r.id,
    documentId: r.document_id,
    content: r.content,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
  }))
}

/** 某文档的内容块数（校验向量化结果用）。 */
export async function countChunks(_ctx: RequestContext, documentId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}
