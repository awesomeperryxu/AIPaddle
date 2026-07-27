import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAudit } from '@/lib/data/audit'

// GET /api/audit  可选 query: limit / action / since
// 审计日志读取（4.1.3）：需 audit:read（Admin/Auditor），默认拒绝。
export async function GET(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'audit:read')) {
    return Response.json(
      { error: { code: 'forbidden', message: '无权限查看审计日志' } },
      { status: 403 },
    )
  }
  const url = new URL(req.url)
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 0, 1), 500) : undefined
  const action = url.searchParams.get('action') ?? undefined
  const since = url.searchParams.get('since') ?? undefined
  const logs = await listAudit(ctx, { limit, action, since })
  return Response.json({ logs })
}
