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
