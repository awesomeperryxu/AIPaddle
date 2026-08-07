import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getWorkflow, saveWorkflow } from '@/lib/data/workflow'
import { autoFixGraph } from '@/lib/workflow/autofix'
import { checkReadiness } from '@/lib/workflow/readiness'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/workflows/[id]/autofix —— 一键修复可确定的体检项（WF-25）。权限：workflow:update。
//
// 🔴 只修判据明确的问题（当前：要取外部数据的 llm 节点打开联网搜索），
// 并把每条改动回给用户看。悄悄改配置比拦住更糟，所以改了什么必须说清楚，并落审计。
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改工作流' } }, { status: 403 })
  }
  const { id } = await params
  const wf = await getWorkflow(ctx, id)
  if (!wf) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const { graph, fixes } = autoFixGraph(wf.graph)
  if (fixes.length === 0) {
    return Response.json({ fixes: [], readiness: checkReadiness(wf.graph), message: '没有可自动修复的项' })
  }

  const saved = await saveWorkflow(ctx, id, { graph })
  if (!saved) return Response.json({ error: { code: 'save_failed', message: '修复已生成但保存失败' } }, { status: 500 })

  const readiness = checkReadiness(saved.graph)
  await writeAudit(ctx, 'workflow.autofix', 'workflow', id, {
    name: wf.name, fixes: fixes.map((f) => `${f.nodeLabel}: ${f.action}`), ready: readiness.ready,
  })
  return Response.json({ fixes, readiness, graph: saved.graph })
}
