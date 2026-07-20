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
