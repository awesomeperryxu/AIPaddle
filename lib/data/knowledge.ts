import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 知识库数据层（ADR-008）：请求级客户端 + RLS，按租户隔离。
export type KnowledgeBase = {
  id: string
  name: string
  description: string
  status: string
  documentCount: number
  createdAt: string
}

type KbRow = {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string | null
}

export async function listKnowledgeBases(_ctx: RequestContext): Promise<KnowledgeBase[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('id,name,description,status,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data as KbRow[] | null) ?? []
  // 各库文档数
  const counts = new Map<string, number>()
  if (rows.length) {
    const { data: docs } = await supabase
      .from('documents')
      .select('kb_id')
      .is('deleted_at', null)
    for (const d of (docs as { kb_id: string }[] | null) ?? []) {
      counts.set(d.kb_id, (counts.get(d.kb_id) ?? 0) + 1)
    }
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    documentCount: counts.get(r.id) ?? 0,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }))
}

export async function createKnowledgeBase(
  ctx: RequestContext,
  input: { name: string; description?: string },
): Promise<KnowledgeBase> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .insert({
      org_id: ctx.orgId,
      name: input.name,
      description: input.description ?? null,
      status: 'active',
    })
    .select('id,name,description,status,created_at')
    .single()
  if (error) throw new Error(error.message)
  const r = data as KbRow
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    documentCount: 0,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

/** 取本租户第一个知识库；没有则建一个默认库（供文档上传挂载）。 */
export async function ensureDefaultKb(ctx: RequestContext): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('knowledge_bases')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (data?.id) return data.id
  const kb = await createKnowledgeBase(ctx, { name: '默认知识库', description: '文档默认归属' })
  return kb.id
}
