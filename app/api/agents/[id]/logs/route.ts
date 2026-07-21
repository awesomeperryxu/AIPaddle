import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listCallLogsByAgent, countCallsByAgent } from '@/lib/data/call-logs'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/agents/[id]/logs —— Agent 调用日志（4.1.5）。权限：audit:read。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'audit:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看日志' } }, { status: 403 })
  }
  const { id } = await params
  const [logs, count] = await Promise.all([
    listCallLogsByAgent(ctx, id),
    countCallsByAgent(ctx, id),
  ])
  return Response.json({ logs, count })
}
