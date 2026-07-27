import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

export type AgentSchedule = {
  id: string
  agentId: string
  agentName: string
  cronExpr: string
  triggerPrompt: string
  isEnabled: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: 'success' | 'error' | null
  consecutiveFailures: number
  createdAt: string
}

export type AgentScheduleRun = {
  id: string
  scheduleId: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'error'
  replySnippet: string | null
  error: string | null
  durationMs: number | null
}

type ScheduleRow = {
  id: string
  agent_id: string
  cron_expr: string
  trigger_prompt: string
  is_enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  consecutive_failures: number
  created_at: string
  agents: { name: string } | null
}

type RunRow = {
  id: string
  schedule_id: string
  started_at: string
  finished_at: string | null
  status: string
  reply_snippet: string | null
  error: string | null
  duration_ms: number | null
}

function mapSchedule(r: ScheduleRow): AgentSchedule {
  return {
    id: r.id,
    agentId: r.agent_id,
    agentName: r.agents?.name ?? '—',
    cronExpr: r.cron_expr,
    triggerPrompt: r.trigger_prompt,
    isEnabled: r.is_enabled,
    nextRunAt: r.next_run_at,
    lastRunAt: r.last_run_at,
    lastStatus: (r.last_status as AgentSchedule['lastStatus']) ?? null,
    consecutiveFailures: r.consecutive_failures,
    createdAt: r.created_at,
  }
}

function mapRun(r: RunRow): AgentScheduleRun {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status as AgentScheduleRun['status'],
    replySnippet: r.reply_snippet,
    error: r.error,
    durationMs: r.duration_ms,
  }
}

export async function listSchedules(_ctx: RequestContext): Promise<AgentSchedule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_schedules')
    .select('*, agents(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ScheduleRow[]).map(mapSchedule)
}

export async function getScheduleByAgent(
  _ctx: RequestContext,
  agentId: string,
): Promise<AgentSchedule | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_schedules')
    .select('*, agents(name)')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapSchedule(data as ScheduleRow)
}

export async function createSchedule(
  _ctx: RequestContext,
  orgId: string,
  payload: { agentId: string; cronExpr: string; triggerPrompt: string; nextRunAt?: string | null },
): Promise<AgentSchedule> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_schedules')
    .insert({
      org_id: orgId,
      agent_id: payload.agentId,
      cron_expr: payload.cronExpr,
      trigger_prompt: payload.triggerPrompt,
      next_run_at: payload.nextRunAt ?? null,
    })
    .select('*, agents(name)')
    .single()
  if (error) throw error
  return mapSchedule(data as ScheduleRow)
}

export async function updateSchedule(
  _ctx: RequestContext,
  id: string,
  patch: Partial<{
    cronExpr: string
    triggerPrompt: string
    isEnabled: boolean
    nextRunAt: string | null
  }>,
): Promise<void> {
  const supabase = await createClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.cronExpr !== undefined) update.cron_expr = patch.cronExpr
  if (patch.triggerPrompt !== undefined) update.trigger_prompt = patch.triggerPrompt
  if (patch.isEnabled !== undefined) update.is_enabled = patch.isEnabled
  if (patch.nextRunAt !== undefined) update.next_run_at = patch.nextRunAt
  const { error } = await supabase.from('agent_schedules').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteSchedule(_ctx: RequestContext, id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('agent_schedules').delete().eq('id', id)
  if (error) throw error
}

export async function listScheduleRuns(
  _ctx: RequestContext,
  scheduleId: string,
  limit = 30,
): Promise<AgentScheduleRun[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_schedule_runs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as RunRow[]).map(mapRun)
}
