import { getRequestContext } from '@/lib/context'
import { updateSchedule, deleteSchedule } from '@/lib/data/agent-schedules'
import { can } from '@/lib/auth/permissions'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/agent-schedules/[id] — 更新（含开关切换）
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })
  if (!can(ctx, 'agent:update'))
    return Response.json({ error: { code: 'forbidden' } }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  const patch: Parameters<typeof updateSchedule>[2] = {}
  if (typeof body?.cronExpr === 'string') patch.cronExpr = body.cronExpr as string
  if (typeof body?.triggerPrompt === 'string') patch.triggerPrompt = body.triggerPrompt as string
  if (typeof body?.isEnabled === 'boolean') patch.isEnabled = body.isEnabled as boolean
  if (typeof body?.nextRunAt === 'string' || body?.nextRunAt === null)
    patch.nextRunAt = body.nextRunAt as string | null

  try {
    await updateSchedule(ctx, id, patch)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: { code: 'db_error' } }, { status: 500 })
  }
}

// DELETE /api/agent-schedules/[id] — 删除
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })
  if (!can(ctx, 'agent:update'))
    return Response.json({ error: { code: 'forbidden' } }, { status: 403 })

  const { id } = await params
  try {
    await deleteSchedule(ctx, id)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: { code: 'db_error' } }, { status: 500 })
  }
}
