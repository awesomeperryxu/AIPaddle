import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getWorkflow } from '@/lib/data/workflow'
import { executeGraph } from '@/lib/workflow/execute'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/workflows/[id]/run —— 运行工作流（4.4.3 最小执行引擎）。
// 权限：workflow:run。执行结果 + 每节点 trace 记入 workflow_runs（RLS 隔离），并回带。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:run')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：运行工作流' } }, { status: 403 })
  }
  const { id } = await params
  const wf = await getWorkflow(ctx, id)
  if (!wf) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const input = typeof body?.input === 'string' ? body.input : ''

  const t0 = Date.now()
  const result = await executeGraph(wf.graph, input)
  const durationMs = Date.now() - t0

  // 记运行历史（workflow_runs，请求级客户端→RLS 按 org 隔离）
  const supabase = await createClient()
  const { data: run } = await supabase
    .from('workflow_runs')
    .insert({
      org_id: ctx.orgId,
      workflow_id: id,
      triggered_by: ctx.userId,
      status: result.status,
      input: { text: input },
      output: { text: result.output },
      node_traces: result.traces,
      duration_ms: durationMs,
    })
    .select('id')
    .maybeSingle()

  return Response.json({
    run: { id: run?.id ?? null, status: result.status, output: result.output, traces: result.traces, durationMs },
  })
}
