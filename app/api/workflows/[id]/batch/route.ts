import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getWorkflow } from '@/lib/data/workflow'
import { executeGraph } from '@/lib/workflow/execute'
import { parseBatchInputs, MAX_BATCH } from '@/lib/workflow/batch'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/workflows/[id]/batch —— 批量运行（4.4.11）。body { inputs: string[] }。
// 权限 workflow:run。逐条执行同一工作流图，各自记入运行历史（RLS 隔离），回带结果。
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
  const { inputs, truncated } = parseBatchInputs(body?.inputs)
  if (inputs.length === 0) {
    return Response.json({ error: { code: 'invalid', message: 'inputs 需为非空字符串数组' } }, { status: 400 })
  }

  const supabase = await createClient()
  const results: Array<{ id: string | null; input: string; status: string; output: string; durationMs: number }> = []
  for (const input of inputs) {
    const t0 = Date.now()
    const result = await executeGraph(wf.graph, input)
    const durationMs = Date.now() - t0
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
    results.push({ id: run?.id ?? null, input, status: result.status, output: result.output, durationMs })
  }

  // 如实回报截断（超过上限的输入被丢弃，非静默）
  return Response.json({ results, count: results.length, truncated, max: MAX_BATCH })
}
