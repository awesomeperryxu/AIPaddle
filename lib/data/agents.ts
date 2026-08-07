import 'server-only'
import { assertAgentName } from '@/lib/agents/name'
import type { Agent } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TRANSITIONS, type TransitionAction } from '@/lib/agents/status'
import type { AgentConfig } from '@/lib/agents/config'
import { deriveAgentCategory, type AgentOrigin } from '@/lib/agents/taxonomy'

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
  config: { model?: string; openingStatement?: string; suggestedQuestions?: string[] } | null
  origin: AgentOrigin
  mandatory: boolean
}

const COLS = 'id,name,description,department,status,metrics_calls,metrics_success,created_at,config,origin,mandatory'

function mapRow(r: Row): Agent {
  const calls = r.metrics_calls ?? 0
  const origin: AgentOrigin = r.origin === 'platform' ? 'platform' : 'user'
  const mandatory = !!r.mandatory
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
    origin,
    mandatory,
    category: deriveAgentCategory(origin, mandatory, r.status),
    openingStatement: r.config?.openingStatement as string | undefined,
    suggestedQuestions: r.config?.suggestedQuestions as string[] | undefined,
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
  if (typeof patch.name === 'string') fields.name = assertAgentName(patch.name)
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

/** 删除结果：区分「不存在/无权」与「已发布须先下线」，路由据此给 404 / 409。 */
export type DeleteAgentResult = 'deleted' | 'not_found' | 'published'

// 软删除单个 Agent（置 deleted_at）。RLS 兜底租户隔离：他租户 id 影响 0 行 → not_found → 路由 404。
// 已删除的再删也返回 not_found（`.is('deleted_at', null)` 只命中未删行），保证幂等且不泄露存在性。
export async function deleteAgent(_ctx: RequestContext, id: string): Promise<DeleteAgentResult> {
  if (!UUID_RE.test(id)) return 'not_found'
  const supabase = await createClient()

  // 🔴 已发布的必须先下线才能删（S1-CRUD-04）。此前对任何状态一律直接软删——
  // 线上正在被调用的 Agent 可以被一键删掉，使用方毫无预警。删除本身是软删可恢复，
  // 但「谁在用」这件事在删掉的瞬间就断了，所以拦在删除前而不是事后补救。
  //
  // 拦截条件写进 update 本身而非「先查后写」：并发下「查到是 offline → 期间被发布
  // → 仍然删掉」的窗口必须靠单条语句关掉（BUG-89 的教训）。
  const { data, error } = await supabase
    .from('agents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .neq('status', 'published')
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return 'deleted'

  // 0 行有两种原因，回查一次仅用于**区分错误码**（不参与是否删除的判定，
  // 因此不重新引入并发窗口）：还在且是 published → 让用户知道要先下线。
  const { data: existing } = await supabase
    .from('agents')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  return (existing as { status?: string } | null)?.status === 'published' ? 'published' : 'not_found'
}

export async function createAgent(
  ctx: RequestContext,
  input: {
    name: string
    department?: string
    description?: string
    systemPrompt?: string
    model?: string
    origin?: AgentOrigin
    mandatory?: boolean
    /** 完整编排配置（brainMode / brainWorkflowId 等）。与 systemPrompt/model 并存时以本字段为底、后两者覆盖 */
    config?: Record<string, unknown>
  },
): Promise<Agent> {
  // WF-6：助理编排需要建 Agent 时直接绑定 brainMode/brainWorkflowId——
  // 那是「定时到点真正跑工作流」的开关，缺了会静默退化成模型自由发挥。
  // 此前这里只认 systemPrompt/model 两个字段，其余配置无处可传。
  const config: Record<string, unknown> = { ...(input.config ?? {}) }
  if (input.systemPrompt) config.systemPrompt = input.systemPrompt
  if (input.model) config.model = input.model
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: assertAgentName(input.name),
      department: input.department ?? null,
      description: input.description ?? null,
      status: 'draft', // AI 生成/手工创建一律 draft，发布须走审核（4.1.2/4.1.3）
      origin: input.origin ?? 'user', // 默认租户用户来源（类三/四）
      mandatory: input.mandatory ?? false, // 默认非强制（设强制须企业级权限，见 API 守卫）
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
  // 大脑（4.1.9）
  brainMode?: 'llm' | 'workflow' | 'routing'
  brainWorkflowId?: string | null
  routingRules?: { keyword: string; skillId: string }[]
  // Features（4.1.12）
  citationEnabled?: boolean
  moderationEnabled?: boolean
  // 内容审查配置（v1.14）
  moderationKeywords?: string[]
  moderationLevel?: 'keywords' | 'ai' | 'both'
  moderationOutputEnabled?: boolean
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
  const cfg = (data.config ?? {}) as {
    model?: string; systemPrompt?: string; temperature?: number
    brainMode?: 'llm' | 'workflow' | 'routing'; brainWorkflowId?: string | null
    routingRules?: { keyword: string; skillId: string }[]
    citationEnabled?: boolean; moderationEnabled?: boolean
    moderationKeywords?: string[]; moderationLevel?: 'keywords' | 'ai' | 'both'; moderationOutputEnabled?: boolean
  }
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description ?? '') as string,
    status: data.status as Agent['status'],
    model: cfg.model,
    systemPrompt: cfg.systemPrompt,
    temperature: cfg.temperature,
    brainMode: cfg.brainMode,
    brainWorkflowId: cfg.brainWorkflowId,
    routingRules: cfg.routingRules,
    citationEnabled: cfg.citationEnabled,
    moderationEnabled: cfg.moderationEnabled,
    moderationKeywords: cfg.moderationKeywords,
    moderationLevel: cfg.moderationLevel,
    moderationOutputEnabled: cfg.moderationOutputEnabled,
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
  patch: {
    name?: string
    department?: string
    description?: string
    config?: Partial<AgentConfig>
    origin?: AgentOrigin
    mandatory?: boolean
  },
): Promise<AgentDetail | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  // 编排页顶栏改名走的是这条（不是 updateAgent），名称校验必须在这里也生效
  if (typeof patch.name === 'string') fields.name = assertAgentName(patch.name)
  if (typeof patch.description === 'string') fields.description = patch.description
  if (typeof patch.department === 'string') fields.department = patch.department
  if (patch.origin === 'platform' || patch.origin === 'user') fields.origin = patch.origin
  if (typeof patch.mandatory === 'boolean') fields.mandatory = patch.mandatory
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
