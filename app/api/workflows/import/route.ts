import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createWorkflow, saveWorkflow } from '@/lib/data/workflow'
import { parseDSL } from '@/lib/workflow/dsl'
import type { WorkflowGraph } from '@/lib/workflow/validate'

// POST /api/workflows/import —— 导入 DSL 建草稿工作流（4.4.12）。workflow:create。
// body = DSL 文档（{ aipaddle_dsl:'v1', kind, name, graph }）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：导入工作流' } }, { status: 403 })
  }
  const body = await request.json().catch(() => null)
  const parsed = parseDSL(body)
  if (!parsed.ok) return Response.json({ error: { code: 'invalid', message: parsed.error } }, { status: 400 })

  const wf = await createWorkflow(ctx, { name: parsed.value.name, type: parsed.value.type })
  const saved = await saveWorkflow(ctx, wf.id, { graph: parsed.value.graph as WorkflowGraph })
  return Response.json({ workflow: saved ?? wf })
}
