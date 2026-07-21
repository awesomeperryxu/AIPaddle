import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getMyTenant } from '@/lib/data/tenant'

// GET /api/tenant —— 本租户信息 + 配额 + 用量（4.5.2）。
// 权限：tenant:read（Admin/Auditor，ADR-007）。RLS 保证只能读到本租户。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'tenant:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看租户信息' } }, { status: 403 })
  }
  const tenant = await getMyTenant(ctx)
  if (!tenant) {
    return Response.json({ error: { code: 'not_found', message: '租户不存在' } }, { status: 404 })
  }
  return Response.json({ tenant })
}
