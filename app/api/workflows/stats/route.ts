import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflowRunStats } from '@/lib/data/workflow'

// GET /api/workflows/stats —— 本租户各工作流运行统计（RLS 隔离，workflow:read）。
// 供列表页卡片展示真实执行次数/成功率（GX-5：去硬编码 0）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const stats = await getWorkflowRunStats(ctx)
  return Response.json({ stats })
}
