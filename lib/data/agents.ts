import 'server-only'
import type { Agent } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

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

export async function createAgent(
  ctx: RequestContext,
  input: { name: string; department?: string; description?: string },
): Promise<Agent> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name,
      department: input.department ?? null,
      description: input.description ?? null,
      status: 'draft',
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as Row)
}
