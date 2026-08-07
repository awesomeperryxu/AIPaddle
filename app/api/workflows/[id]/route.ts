import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflow, saveWorkflowChecked, deleteWorkflow } from '@/lib/data/workflow'
import { validateGraph } from '@/lib/workflow/validate'
import { validateToolNodes } from '@/lib/workflow/validate-tools'

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

  // WF-28 乐观锁：前端带上它加载时的 updatedAt，服务端发现库里已经更新过就拒绝写入。
  // 🔴 没有这道闸时，开着的编辑器会用内存里的旧图整张覆盖回去，把别人（或后台修复）
  // 刚写进去的改动**静默抹掉**——不带 baseUpdatedAt 的老客户端仍按原样放行，不破坏兼容。
  const baseUpdatedAt = typeof body?.baseUpdatedAt === 'string' ? body.baseUpdatedAt : undefined
  const outcome = await saveWorkflowChecked(ctx, id, {
    name: typeof body?.name === 'string' ? body.name : undefined,
    graph,
  }, baseUpdatedAt)
  if (!outcome.ok && outcome.reason === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  if (!outcome.ok) {
    return Response.json({
      error: { code: 'conflict', message: '这条工作流已被更新（可能是另一个窗口或后台修复），请刷新后再改，以免覆盖对方的改动' },
      current: outcome.current,
    }, { status: 409 })
  }
  const workflow = outcome.workflow

  // 结构校验 + Tool 节点校验（4.4.2：Tool 只引用已发布 Skill、拒直连 MCP）
  const validation = [...validateGraph(workflow.graph), ...(await validateToolNodes(ctx, workflow.graph))]
  return Response.json({ workflow, validation, valid: validation.length === 0 })
}

// DELETE /api/workflows/[id] —— 软删工作流（GX-5 补遗）。workflow:delete。
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除工作流' } }, { status: 403 })
  }
  const { id } = await params
  await deleteWorkflow(ctx, id)
  return Response.json({ ok: true })
}
