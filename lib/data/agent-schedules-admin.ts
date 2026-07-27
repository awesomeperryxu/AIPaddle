import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// ⚠️ 仅用于 Cron Job（service_role 绕过 RLS）。
// 普通业务读写走 lib/data/agent-schedules.ts（请求级 RLS 客户端）。

type DueSchedule = {
  id: string
  org_id: string
  agent_id: string
  cron_expr: string
  trigger_prompt: string
  consecutive_failures: number
}

// 查询所有应立即执行的定时作业（next_run_at <= now, is_enabled=true）
export async function listDueSchedules(): Promise<DueSchedule[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agent_schedules')
    .select('id,org_id,agent_id,cron_expr,trigger_prompt,consecutive_failures')
    .eq('is_enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .not('next_run_at', 'is', null)
  if (error) throw error
  return (data ?? []) as DueSchedule[]
}

// 写执行记录（running → 落 run_id；调用完毕后 updateRun 写最终状态）
export async function createRun(params: {
  scheduleId: string
  orgId: string
}): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agent_schedule_runs')
    .insert({
      schedule_id: params.scheduleId,
      org_id: params.orgId,
      status: 'running',
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

// 更新执行记录（成功/失败）
export async function updateRun(runId: string, params: {
  status: 'success' | 'error'
  replySnippet?: string
  error?: string
  durationMs: number
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('agent_schedule_runs')
    .update({
      status: params.status,
      finished_at: new Date().toISOString(),
      reply_snippet: params.replySnippet?.slice(0, 200) ?? null,
      error: params.error?.slice(0, 500) ?? null,
      duration_ms: params.durationMs,
    })
    .eq('id', runId)
  if (error) throw error
}

// 更新 schedule 执行结果：last_run_at / last_status / consecutive_failures / next_run_at
// 连续失败 ≥ 3 次自动停用
export async function updateScheduleAfterRun(
  scheduleId: string,
  success: boolean,
  nextRunAt: string,
): Promise<void> {
  const admin = createAdminClient()

  if (success) {
    await admin.from('agent_schedules').update({
      last_run_at: new Date().toISOString(),
      last_status: 'success',
      consecutive_failures: 0,
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    }).eq('id', scheduleId)
  } else {
    // 先读当前 consecutive_failures
    const { data } = await admin
      .from('agent_schedules')
      .select('consecutive_failures')
      .eq('id', scheduleId)
      .single()
    const prev = (data as { consecutive_failures: number } | null)?.consecutive_failures ?? 0
    const next = prev + 1
    await admin.from('agent_schedules').update({
      last_run_at: new Date().toISOString(),
      last_status: 'error',
      consecutive_failures: next,
      next_run_at: nextRunAt,
      is_enabled: next >= 3 ? false : true,
      updated_at: new Date().toISOString(),
    }).eq('id', scheduleId)
  }
}
