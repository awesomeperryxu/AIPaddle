import { Cron } from 'croner'
import {
  listDueSchedules,
  createRun,
  updateRun,
  updateScheduleAfterRun,
} from '@/lib/data/agent-schedules-admin'
import { invokeCronAgent } from '@/lib/agents/cron-invoke'

// POST /api/cron/agent-schedules
// 由 Vercel Cron Job 每分钟触发（vercel.json）。
// 鉴权：Bearer CRON_SECRET（Vercel 自动附带；本地开发若不设则跳过）。
// 执行逻辑：admin client 查到期 schedules → 直接调 invokeCronAgent → 写 runs → 更新 schedule 状态。
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let schedules: Awaited<ReturnType<typeof listDueSchedules>>
  try {
    schedules = await listDueSchedules()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: 'db_error', detail: msg }, { status: 500 })
  }

  if (schedules.length === 0) {
    return Response.json({ processed: 0 })
  }

  const results: { scheduleId: string; status: 'success' | 'error'; agentId: string }[] = []

  for (const sched of schedules) {
    const runId = await createRun({ scheduleId: sched.id, orgId: sched.org_id }).catch(() => null)
    if (!runId) continue

    const startedAt = Date.now()
    let success = false
    let replySnippet: string | undefined
    let errorMsg: string | undefined

    try {
      const { reply } = await invokeCronAgent({
        agentId: sched.agent_id,
        orgId: sched.org_id,
        triggerPrompt: sched.trigger_prompt,
      })
      replySnippet = reply
      success = true
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e)
    }

    const durationMs = Date.now() - startedAt

    await updateRun(runId, {
      status: success ? 'success' : 'error',
      replySnippet,
      error: errorMsg,
      durationMs,
    }).catch(() => {})

    const nextRunAt = computeNextRun(sched.cron_expr)
    await updateScheduleAfterRun(sched.id, success, nextRunAt).catch(() => {})

    results.push({ scheduleId: sched.id, agentId: sched.agent_id, status: success ? 'success' : 'error' })
  }

  return Response.json({ processed: results.length, results })
}

function computeNextRun(cronExpr: string): string {
  try {
    const job = new Cron(cronExpr, { timezone: 'Asia/Shanghai' })
    const next = job.nextRun()
    return next ? next.toISOString() : new Date(Date.now() + 60_000).toISOString()
  } catch {
    return new Date(Date.now() + 60_000).toISOString()
  }
}
