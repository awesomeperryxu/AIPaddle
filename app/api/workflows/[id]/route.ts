import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflowById, updateWorkflow, deleteWorkflow, type WorkflowGraphJson } from '@/lib/data/workflows'
import { validateGraph, type GraphNode, type GraphEdge } from '@/lib/workflow/validate'

// 从存储的 graph jsonb 提取校验器所需的最小结构（id/type、source/target）。
function toValidatorGraph(graph: WorkflowGraphJson) {
  const nodes: GraphNode[] = (graph?.nodes ?? []).map((n) => {
    const o = (n ?? {}) as Record<string, unknown>
    return { id: String(o.id ?? ''), type: String(o.type ?? ''), title: o.title as string | undefined }
  })
  const edges: GraphEdge[] = (graph?.edges ?? []).map((e) => {
    const o = (e ?? {}) as Record<string, unknown>
    return { source: String(o.source ?? ''), target: String(o.target ?? '') }
  })
  return { nodes, edges }
}

// GET /api/workflows/[id] —— 取完整工作流（含 graph）。他租户/不存在 → 404。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const { id } = await params
  const workflow = await getWorkflowById(ctx, id)
  if (!workflow) {
    return Response.json({ error: { code: 'not_found', message: '工作流不存在' } }, { status: 404 })
  }
  return Response.json({ workflow })
}

// PATCH /api/workflows/[id] —— 保存名称/图。权限 workflow:update；提交的 graph 先过结构校验，
// 非法（缺开始/结束、孤立节点、成环、悬空连线）→ 422 并返回定位到节点的错误（S4-02），不落库。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'workflow:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：编辑工作流' } }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  const patch: { name?: string; graph?: WorkflowGraphJson } = {}
  if (typeof body?.name === 'string') patch.name = body.name
  if (body?.graph && typeof body.graph === 'object') {
    const graph = body.graph as WorkflowGraphJson
    const errors = validateGraph(toValidatorGraph(graph))
    if (errors.length > 0) {
      return Response.json(
        { error: { code: 'invalid_graph', message: errors[0].message, details: errors } },
        { status: 422 },
      )
    }
    patch.graph = graph
  }

  const workflow = await updateWorkflow(ctx, id, patch)
  if (!workflow) {
    return Response.json({ error: { code: 'not_found', message: '工作流不存在' } }, { status: 404 })
  }
  return Response.json({ workflow })
}

// DELETE /api/workflows/[id] —— 软删除。权限 workflow:delete；他租户/已删 → 404（幂等）。
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'workflow:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除工作流' } }, { status: 403 })
  }
  const { id } = await params
  const ok = await deleteWorkflow(ctx, id)
  if (!ok) {
    return Response.json({ error: { code: 'not_found', message: '工作流不存在' } }, { status: 404 })
  }
  return Response.json({ ok: true })
}
