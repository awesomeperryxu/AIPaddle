import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflow } from '@/lib/data/workflow'
import { exportDSL } from '@/lib/workflow/dsl'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/workflows/[id]/dsl —— 导出工作流为自有 DSL（4.4.12）。workflow:read。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const { id } = await params
  const wf = await getWorkflow(ctx, id)
  if (!wf) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const dsl = exportDSL({ name: wf.name, type: wf.type, graph: wf.graph })
  return Response.json(dsl, {
    headers: { 'Content-Disposition': `attachment; filename="${encodeURIComponent(wf.name || 'workflow')}.aipaddle.json"` },
  })
}
