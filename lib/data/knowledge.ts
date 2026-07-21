import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 知识库数据层（ADR-008）：请求级客户端 + RLS，按租户隔离。
export type KbVisibility = 'org' | 'restricted'

export type KnowledgeBase = {
  id: string
  name: string
  description: string
  status: string
  visibility: KbVisibility
  documentCount: number
  createdAt: string
}

type KbRow = {
  id: string
  name: string
  description: string | null
  status: string
  visibility: string | null
  created_at: string | null
}

export async function listKnowledgeBases(_ctx: RequestContext): Promise<KnowledgeBase[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('id,name,description,status,visibility,created_at')
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
    visibility: (r.visibility as KbVisibility) ?? 'org',
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
    .select('id,name,description,status,visibility,created_at')
    .single()
  if (error) throw new Error(error.message)
  const r = data as KbRow
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    visibility: (r.visibility as KbVisibility) ?? 'org',
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

// ── 4.2.8 知识库权限范围 ────────────────────────────────────

/** 设置知识库可见性（org=全员可见 / restricted=仅关联 Agent 可用）。 */
export async function setKbVisibility(
  _ctx: RequestContext,
  kbId: string,
  visibility: KbVisibility,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('knowledge_bases')
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq('id', kbId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

export type KbAgentLink = { agentId: string; name: string }

/** 列出关联到某知识库的 Agent（经 agent_resources）。 */
export async function listKbAgents(_ctx: RequestContext, kbId: string): Promise<KbAgentLink[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_resources')
    .select('agent_id, agents(id,name)')
    .eq('resource_type', 'knowledge_base')
    .eq('resource_id', kbId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  type Row = { agent_id: string; agents: { id: string; name: string } | { id: string; name: string }[] | null }
  return ((data as Row[] | null) ?? []).map((r) => {
    const a = Array.isArray(r.agents) ? r.agents[0] : r.agents
    return { agentId: r.agent_id, name: a?.name ?? '(未知)' }
  })
}

/** 覆盖式设置某知识库关联的 Agent 集合（软删旧关联，插入新关联）。 */
export async function setKbAgents(
  ctx: RequestContext,
  kbId: string,
  agentIds: string[],
): Promise<void> {
  const supabase = await createClient()
  // 软删该 KB 现有关联
  const { error: delErr } = await supabase
    .from('agent_resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('resource_type', 'knowledge_base')
    .eq('resource_id', kbId)
    .is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)
  if (agentIds.length === 0) return
  const rows = agentIds.map((agentId) => ({
    org_id: ctx.orgId,
    agent_id: agentId,
    resource_type: 'knowledge_base',
    resource_id: kbId,
  }))
  const { error: insErr } = await supabase.from('agent_resources').insert(rows)
  if (insErr) throw new Error(insErr.message)
}

/**
 * 计算可访问的知识库 id 范围（RAG 检索用）：
 * - 传 agentId（Agent 对话）→ 该 Agent 关联的知识库；
 * - 不传（通用问答）→ 全员可见（visibility='org'）的知识库。
 */
export async function listAccessibleKbIds(
  _ctx: RequestContext,
  opts?: { agentId?: string },
): Promise<string[]> {
  const supabase = await createClient()
  if (opts?.agentId) {
    const { data, error } = await supabase
      .from('agent_resources')
      .select('resource_id')
      .eq('resource_type', 'knowledge_base')
      .eq('agent_id', opts.agentId)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    return ((data as { resource_id: string }[] | null) ?? []).map((r) => r.resource_id)
  }
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('visibility', 'org')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
}
