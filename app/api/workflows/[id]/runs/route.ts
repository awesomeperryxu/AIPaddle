import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listRuns } from '@/lib/data/workflow'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/workflows/[id]/runs —— 运行历史（4.4.4）。workflow:read。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const { id } = await params
  const runs = await listRuns(ctx, id)
  return Response.json({ runs })
}
