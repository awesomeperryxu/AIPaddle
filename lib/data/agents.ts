import 'server-only'
import type { Agent } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TRANSITIONS, type TransitionAction } from '@/lib/agents/status'
import type { AgentConfig } from '@/lib/agents/config'

// 数据层（ADR-008）：唯一访问 agents 表的地方，首参 ctx，用请求级客户端（RLS 生效）。
// DB 行 → 视图用的 Agent 形状映射。
type Row = {
  id: string
  name: string
  description: string | null
  department: string | null
  status: Agent['status']
  metrics_calls: number | null
  metrics_success: number | null
  created_at: string | null
  config: { model?: string } | null
}

const COLS = 'id,name,description,department,status,metrics_calls,metrics_success,created_at,config'

function mapRow(r: Row): Agent {
  const calls = r.metrics_calls ?? 0
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    department: r.department ?? '',
    status: r.status,
    calls,
    successRate: calls > 0 ? Math.round(((r.metrics_success ?? 0) / calls) * 1000) / 10 : 0,
    tokenUsage: 0,
    createdAt: (r.created_at ?? '').slice(0, 10),
    model: r.config?.model ?? '—',
    avatar: '🤖',
  }
}

export async function listAgents(_ctx: RequestContext): Promise<Agent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select(COLS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Row[] | null ?? []).map(mapRow)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 按 id 取单个 Agent。RLS 只放行本租户 → 他租户 id 查不到，返回 null（路由据此回 404）。
// 非法 UUID（如猜测的 '1'）直接当"不存在"，返回 null，避免 DB 抛错变 500。
export async function getAgentById(_ctx: RequestContext, id: string): Promise<Agent | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select(COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

// 更新单个 Agent（部分字段）。RLS 兜底租户隔离：他租户 id 更新影响 0 行 → 返回 null → 路由 404。
export async function updateAgent(
  _ctx: RequestContext,
  id: string,
  patch: { name?: string; description?: string; department?: string },
): Promise<Agent | null> {
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (typeof patch.description === 'string') fields.description = patch.description
  if (typeof patch.department === 'string') fields.department = patch.department
  if (!UUID_RE.test(id)) return null
  if (Object.keys(fields).length === 0) return getAgentById(_ctx, id)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

// 软删除单个 Agent（置 deleted_at）。RLS 兜底租户隔离：他租户 id 影响 0 行 → false → 路由 404。
// 已删除的再删也返回 false（`.is('deleted_at', null)` 只命中未删行），保证幂等且不泄露存在性。
export async function deleteAgent(_ctx: RequestContext, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

export async function createAgent(
  ctx: RequestContext,
  input: { name: string; department?: string; description?: string; systemPrompt?: string; model?: string },
): Promise<Agent> {
  const config: Record<string, unknown> = {}
  if (input.systemPrompt) config.systemPrompt = input.systemPrompt
  if (input.model) config.model = input.model
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name,
      department: input.department ?? null,
      description: input.description ?? null,
      status: 'draft', // AI 生成/手工创建一律 draft，发布须走审核（4.1.2/4.1.3）
      config,
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as Row)
}

// 取 Agent 对话所需配置（4.1.4）。含 config 里的 model/systemPrompt，用于组装对话请求。
export type AgentChatConfig = {
  id: string
  name: string
  description: string
  status: Agent['status']
  model?: string
  systemPrompt?: string
  temperature?: number
}

export async function getAgentForChat(_ctx: RequestContext, id: string): Promise<AgentChatConfig | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select('id,name,description,status,config')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const cfg = (data.config ?? {}) as { model?: string; systemPrompt?: string; temperature?: number }
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description ?? '') as string,
    status: data.status as Agent['status'],
    model: cfg.model,
    systemPrompt: cfg.systemPrompt,
    temperature: cfg.temperature,
  }
}

// ── 4.1.7：Agent 编排配置（含 config 全量）─────────────────────
export type AgentDetail = {
  id: string
  name: string
  description: string
  department: string
  status: Agent['status']
  config: AgentConfig
}

const DETAIL_COLS = 'id,name,description,department,status,config'

// 取 Agent 完整详情（含 config），供编排页编辑。RLS 兜底租户隔离。
export async function getAgentDetail(_ctx: RequestContext, id: string): Promise<AgentDetail | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select(DETAIL_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description ?? '') as string,
    department: (data.department ?? '') as string,
    status: data.status as Agent['status'],
    config: (data.config ?? {}) as AgentConfig,
  }
}

// 保存 Agent（名称/部门/描述 + config 合并）。config 为部分更新，合并进现有 config。
// 校验由调用方（API）用 Zod 完成；此处只做合并落库。RLS 兜底租户隔离。
export async function saveAgent(
  _ctx: RequestContext,
  id: string,
  patch: { name?: string; department?: string; description?: string; config?: Partial<AgentConfig> },
): Promise<AgentDetail | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (typeof patch.description === 'string') fields.description = patch.description
  if (typeof patch.department === 'string') fields.department = patch.department
  if (patch.config && typeof patch.config === 'object') {
    const cur = await getAgentDetail(_ctx, id)
    if (!cur) return null
    fields.config = { ...cur.config, ...patch.config } // 合并（不丢已有键）
  }
  if (Object.keys(fields).length === 0) return getAgentDetail(_ctx, id)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(DETAIL_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description ?? '') as string,
    department: (data.department ?? '') as string,
    status: data.status as Agent['status'],
    config: (data.config ?? {}) as AgentConfig,
  }
}

// 状态机流转（4.1.2）。原子条件更新：仅当当前 status === from 才落库，
// 否则 0 行 → 再查一次区分「不存在/跨租户(RLS)」与「当前态非法流转」。
export async function transitionAgent(
  _ctx: RequestContext,
  id: string,
  action: TransitionAction,
): Promise<{ ok: true; agent: Agent } | { ok: false; reason: 'not_found' | 'illegal' }> {
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }
  const t = TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .update({ status: t.to })
    .eq('id', id)
    .eq('status', t.from)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, agent: mapRow(data as Row) }
  const current = await getAgentById(_ctx, id)
  return { ok: false, reason: current ? 'illegal' : 'not_found' }
}
