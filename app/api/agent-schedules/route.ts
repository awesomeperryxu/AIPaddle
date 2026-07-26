import { getRequestContext } from '@/lib/context'
import { listSchedules, createSchedule } from '@/lib/data/agent-schedules'
import { can } from '@/lib/auth/permissions'

// GET /api/agent-schedules — 列出当前租户全部定时作业
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })
  try {
    const schedules = await listSchedules(ctx)
    return Response.json({ schedules })
  } catch {
    return Response.json({ error: { code: 'db_error' } }, { status: 500 })
  }
}

// POST /api/agent-schedules — 创建定时作业（需 agent:update 权限）
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })
  if (!can(ctx, 'agent:update'))
    return Response.json({ error: { code: 'forbidden' } }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const agentId = String(body?.agentId ?? '').trim()
  const cronExpr = String(body?.cronExpr ?? '').trim()
  const triggerPrompt = String(body?.triggerPrompt ?? '').trim()
  const nextRunAt = typeof body?.nextRunAt === 'string' ? body.nextRunAt : null

  if (!agentId || !cronExpr || !triggerPrompt)
    return Response.json({ error: { code: 'invalid', message: 'agentId/cronExpr/triggerPrompt 必填' } }, { status: 400 })

  try {
    const schedule = await createSchedule(ctx, ctx.orgId, { agentId, cronExpr, triggerPrompt, nextRunAt })
    return Response.json({ schedule }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('unique')) {
      return Response.json({ error: { code: 'conflict', message: '该 Agent 已有定时配置，请在管理页修改' } }, { status: 409 })
    }
    return Response.json({ error: { code: 'db_error' } }, { status: 500 })
  }
}
