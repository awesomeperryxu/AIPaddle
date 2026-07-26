import { getRequestContext } from '@/lib/context'
import { listScheduleRuns } from '@/lib/data/agent-schedules'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/agent-schedules/[id]/runs — 获取执行历史（最近 30 条）
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })

  const { id } = await params
  try {
    const runs = await listScheduleRuns(ctx, id)
    return Response.json({ runs })
  } catch {
    return Response.json({ error: { code: 'db_error' } }, { status: 500 })
  }
}
