import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

export type CallLog = {
  id: string
  agentId: string | null
  model: string | null
  tokensIn: number
  tokensOut: number
  latencyMs: number | null
  success: boolean
  errorCode: string | null
  createdAt: string
}

// 落一条调用日志（4.1.5）。写失败不阻断主流程（对话已完成），只记 console。
export async function recordCall(
  ctx: RequestContext,
  input: {
    agentId: string
    model?: string
    tokensIn?: number
    tokensOut?: number
    latencyMs?: number
    success: boolean
    errorCode?: string
  },
): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('call_logs').insert({
      org_id: ctx.orgId,
      agent_id: input.agentId,
      user_id: ctx.userId,
      model: input.model ?? null,
      tokens_in: input.tokensIn ?? 0,
      tokens_out: input.tokensOut ?? 0,
      latency_ms: input.latencyMs ?? null,
      success: input.success,
      error_code: input.errorCode ?? null,
    })
    if (error) console.error('[call_logs] 写入失败:', error.message)
  } catch (e) {
    console.error('[call_logs] 写入异常:', e)
  }
}

const COLS = 'id,agent_id,model,tokens_in,tokens_out,latency_ms,success,error_code,created_at'

function mapRow(r: Record<string, unknown>): CallLog {
  return {
    id: r.id as string,
    agentId: (r.agent_id ?? null) as string | null,
    model: (r.model ?? null) as string | null,
    tokensIn: (r.tokens_in ?? 0) as number,
    tokensOut: (r.tokens_out ?? 0) as number,
    latencyMs: (r.latency_ms ?? null) as number | null,
    success: !!r.success,
    errorCode: (r.error_code ?? null) as string | null,
    createdAt: (r.created_at ?? '') as string,
  }
}

// 某 Agent 的最近调用日志（租户隔离由 RLS 兜底）。
export async function listCallLogsByAgent(
  _ctx: RequestContext,
  agentId: string,
  limit = 20,
): Promise<CallLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('call_logs')
    .select(COLS)
    .eq('agent_id', agentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// 某 Agent 的调用次数（日志数=实际调用次数）。
export async function countCallsByAgent(_ctx: RequestContext, agentId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}
