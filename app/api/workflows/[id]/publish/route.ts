import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflow, publishWorkflow } from '@/lib/data/workflow'
import { validateGraph } from '@/lib/workflow/validate'
import { validateToolNodes } from '@/lib/workflow/validate-tools'
import { checkReadiness } from '@/lib/workflow/readiness'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/workflows/[id]/publish —— 发布工作流（4.4.4）。workflow:update。
// 发布门槛：图必须合法（非法图 422 返校验错误，不允许发布）。
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：发布工作流' } }, { status: 403 })
  }
  const { id } = await params
  const wf = await getWorkflow(ctx, id)
  if (!wf) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const validation = [...validateGraph(wf.graph), ...(await validateToolNodes(ctx, wf.graph))]
  if (validation.length > 0) {
    return Response.json(
      { error: { code: 'invalid_graph', message: '图不合法，无法发布' }, validation },
      { status: 422 },
    )
  }

  // WF-11 可用性体检：图合法 ≠ 跑得起来。空提示词、编造的假 URL、未挂载的 tool
  // 都会让流程「看着完整、发布出去就是坏的」，发布这一关必须机器把住。
  const readiness = checkReadiness(wf.graph)
  if (!readiness.ready) {
    return Response.json(
      {
        error: { code: 'not_ready', message: '流程未通过可用性体检，请先处理必须项' },
        readiness,
      },
      { status: 422 },
    )
  }

  const workflow = await publishWorkflow(ctx, id)
  if (!workflow) return Response.json({ error: { code: 'not_found', message: '不存在' } }, { status: 404 })
  return Response.json({ workflow, publishedVersion: workflow.version - 1 })
}
