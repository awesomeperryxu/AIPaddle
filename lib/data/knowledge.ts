import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { deleteChunksByDocument } from '@/lib/data/chunks'

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

/** 取单个知识库详情（按 id + org_id）。返回 null 表示不存在或无权限。 */
export async function getKnowledgeBase(_ctx: RequestContext, kbId: string): Promise<KnowledgeBase | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('id,name,description,status,visibility,created_at')
    .eq('id', kbId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as KbRow
  const { data: docs } = await supabase
    .from('documents')
    .select('id')
    .eq('kb_id', kbId)
    .is('deleted_at', null)
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    visibility: (r.visibility as KbVisibility) ?? 'org',
    documentCount: (docs as { id: string }[] | null)?.length ?? 0,
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

// ── 4.2.7 切块参数 ─────────────────────────────────────────

export type KbChunkConfig = { chunkSize: number; chunkOverlap: number; separator: string }
export const DEFAULT_KB_CHUNK_CONFIG: KbChunkConfig = { chunkSize: 800, chunkOverlap: 100, separator: '\n\n' }

/** 读取知识库切块参数；缺列/异常回落默认（向后兼容旧库）。 */
export async function getKbChunkConfig(_ctx: RequestContext, kbId: string): Promise<KbChunkConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('chunk_config')
    .eq('id', kbId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const c = (data as { chunk_config?: Partial<KbChunkConfig> | null } | null)?.chunk_config
  return {
    chunkSize: Number(c?.chunkSize) || DEFAULT_KB_CHUNK_CONFIG.chunkSize,
    chunkOverlap: Number.isFinite(Number(c?.chunkOverlap)) ? Number(c?.chunkOverlap) : DEFAULT_KB_CHUNK_CONFIG.chunkOverlap,
    separator: typeof c?.separator === 'string' ? c.separator : DEFAULT_KB_CHUNK_CONFIG.separator,
  }
}

/** 保存知识库切块参数（应用层已规整）。 */
export async function setKbChunkConfig(_ctx: RequestContext, kbId: string, config: KbChunkConfig): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('knowledge_bases')
    .update({ chunk_config: config, updated_at: new Date().toISOString() })
    .eq('id', kbId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

// ── 4.2.8 检索参数 ─────────────────────────────────────────

export type SearchMethod = 'vector' | 'fulltext' | 'hybrid'
export type KbRetrievalConfig = { topK: number; scoreThreshold: number; searchMethod: SearchMethod }
export const DEFAULT_KB_RETRIEVAL_CONFIG: KbRetrievalConfig = {
  topK: 5, scoreThreshold: 0.28, searchMethod: 'vector',
}

/** 规整检索参数：topK∈[1,20]、阈值∈[0,1]；searchMethod 目前仅 vector 生效（其余回落 vector）。 */
export function normalizeRetrievalConfig(c?: Partial<KbRetrievalConfig> | null): KbRetrievalConfig {
  const rawK = Number(c?.topK)
  const topK = Math.min(Math.max(Math.floor(Number.isFinite(rawK) ? rawK : DEFAULT_KB_RETRIEVAL_CONFIG.topK), 1), 20)
  const rawTh = Number(c?.scoreThreshold)
  const scoreThreshold = Number.isFinite(rawTh) ? Math.min(Math.max(rawTh, 0), 1) : DEFAULT_KB_RETRIEVAL_CONFIG.scoreThreshold
  // 全文/混合检索尚未落地（待 M 道 + tsvector），暂只接受 vector。
  const searchMethod: SearchMethod = c?.searchMethod === 'fulltext' || c?.searchMethod === 'hybrid'
    ? c.searchMethod
    : 'vector'
  return { topK, scoreThreshold, searchMethod }
}

/** 读取知识库检索参数；缺列/异常回落默认。 */
export async function getKbRetrievalConfig(_ctx: RequestContext, kbId: string): Promise<KbRetrievalConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('retrieval_config')
    .eq('id', kbId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return normalizeRetrievalConfig((data as { retrieval_config?: Partial<KbRetrievalConfig> | null } | null)?.retrieval_config)
}

/** 保存知识库检索参数（应用层已规整）。 */
export async function setKbRetrievalConfig(_ctx: RequestContext, kbId: string, config: KbRetrievalConfig): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('knowledge_bases')
    .update({ retrieval_config: config, updated_at: new Date().toISOString() })
    .eq('id', kbId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
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

/** 软删除知识库（4.2.9）：连带软删其文档与内容块，使检索不再命中已删库。 */
export async function updateKnowledgeBase(
  _ctx: RequestContext,
  kbId: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('knowledge_bases')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', kbId)
    .is('deleted_at', null)
}

export async function deleteKnowledgeBase(ctx: RequestContext, kbId: string): Promise<void> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  // 先取本库文档，逐个失效其内容块（与删单文档一致的失效语义）
  const { data: docs } = await supabase
    .from('documents')
    .select('id')
    .eq('kb_id', kbId)
    .is('deleted_at', null)
  for (const d of (docs as { id: string }[] | null) ?? []) {
    await deleteChunksByDocument(ctx, d.id)
  }
  // 软删文档
  await supabase
    .from('documents')
    .update({ deleted_at: now })
    .eq('kb_id', kbId)
    .is('deleted_at', null)
  // 软删知识库本体
  const { error } = await supabase
    .from('knowledge_bases')
    .update({ deleted_at: now, updated_at: now })
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
