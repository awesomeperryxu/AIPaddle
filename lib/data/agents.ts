import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

export type AgentRow = {
  id: string
  name: string
  description: string | null
  department: string | null
  status: 'draft' | 'pending' | 'published' | 'offline'
  usage_scenarios: string[]
  metrics_calls: number
  metrics_success: number
  metrics_avg_ms: number
  created_at: string
  updated_at: string
}

/** 当前租户的 Agent 总数（不含软删除） */
export async function getAgentCount(ctx: RequestContext): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('agents')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

/** 分页列表（RLS 自动过滤当前租户） */
export async function listAgents(
  ctx: RequestContext,
  opts: { page?: number; pageSize?: number; status?: AgentRow['status'] } = {}
): Promise<{ agents: AgentRow[]; total: number }> {
  const { page = 1, pageSize = 20, status } = opts
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  let query = supabase
    .from('agents')
    .select(
      'id,name,description,department,status,usage_scenarios,metrics_calls,metrics_success,metrics_avg_ms,created_at,updated_at',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) throw error
  return { agents: (data ?? []) as AgentRow[], total: count ?? 0 }
}

/** 单条 Agent（当前租户，RLS 自动隔离） */
export async function getAgent(
  ctx: RequestContext,
  id: string
): Promise<AgentRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .select(
      'id,name,description,department,status,usage_scenarios,metrics_calls,metrics_success,metrics_avg_ms,created_at,updated_at'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error?.code === 'PGRST116') return null // not found
  if (error) throw error
  return data as AgentRow
}
