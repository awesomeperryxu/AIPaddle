import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { getTenantUsage, getPlatformRevenueTrend } from '@/lib/data/platform-dashboard'

// GET /api/platform/tenant-usage —— 每租户真实用量聚合 + 近6月估算收入趋势
// 仅平台超管（ADR-010，与 /api/tenants、saas-dashboard 同一 isPlatformAdmin 门控）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可访问' } }, { status: 403 })

  const [usage, revenueTrend] = await Promise.all([getTenantUsage(), getPlatformRevenueTrend()])
  return Response.json({ usage, revenueTrend })
}
