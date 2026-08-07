import { getRequestContext } from '@/lib/context'
import { listMyOrgs } from '@/lib/data/user-orgs'

// GET /api/orgs/mine —— 我能进的组织列表（组织切换器数据源，ADR-025）。
// 不需要额外权限：只返回自己的归属，RLS 兜底。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const orgs = await listMyOrgs(ctx)
  return Response.json({ orgs, activeOrgId: ctx.orgId })
}
