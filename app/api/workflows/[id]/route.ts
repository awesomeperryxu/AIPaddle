import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflow, saveWorkflow } from '@/lib/data/workflow'
import { validateGraph } from '@/lib/workflow/validate'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/workflows/[id] —— 加载工作流（含图，供刷新后画布恢复）。workflow:read。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const { id } = await params
  const workflow = await getWorkflow(ctx, id)
  if (!workflow) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ workflow })
}

// PATCH /api/workflows/[id] —— 保存工作流（名称/图）。workflow:update。
// 草稿允许保存非法图（刷新可恢复），但返回 validation 让前端提示（孤立节点/环等）。
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：保存工作流' } }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const graph =
    body?.graph && typeof body.graph === 'object'
      ? { nodes: Array.isArray((body.graph as { nodes?: unknown }).nodes) ? (body.graph as { nodes: [] }).nodes : [],
          edges: Array.isArray((body.graph as { edges?: unknown }).edges) ? (body.graph as { edges: [] }).edges : [] }
      : undefined

  const workflow = await saveWorkflow(ctx, id, {
    name: typeof body?.name === 'string' ? body.name : undefined,
    graph,
  })
  if (!workflow) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const validation = validateGraph(workflow.graph)
  return Response.json({ workflow, validation, valid: validation.length === 0 })
}
