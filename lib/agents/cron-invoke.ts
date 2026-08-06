import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { chat } from '@/lib/ai'
import { executeGraph } from '@/lib/workflow/execute'
import type { PersistedGraph } from '@/lib/workflow/graph-adapter'

// Cron 调用 Agent（4.1.26）：绕过 HTTP + RLS，用 admin client 直读 agent config。
//
// 🔴 WF-5：此前这里**只调 LLM**，完全没看 brainMode——
// 对话入口（app/api/agents/[id]/chat/route.ts:88）会按大脑分流走 executeGraph，
// 定时入口却不会。于是「Agent 绑了工作流 + 配了定时」的组合看着一切正常
// （有触发、有执行记录、有输出），实际跑的是模型自由发挥，**工作流从未被执行**。
// 这比报错危险：报错会立刻被发现，静默走偏要比对工作流日志才能察觉。
type AgentConfig = {
  systemPrompt?: string
  model?: string
  temperature?: number
  brainMode?: 'llm' | 'workflow' | 'routing'
  brainWorkflowId?: string | null
}

export type CronInvokeResult = {
  reply: string
  /** 实际走的大脑，便于执行历史里核对是否如预期 */
  brain: 'llm' | 'workflow'
  /** 因缺少运行上下文被跳过的节点（见下方说明），为空表示全部正常执行 */
  skippedNodes?: string[]
}

export async function invokeCronAgent(params: {
  agentId: string
  orgId: string
  triggerPrompt: string
}): Promise<CronInvokeResult> {
  const admin = createAdminClient()

  // 读 agent config（admin client，绕过 RLS，但按 org_id 过滤防越权）
  const { data, error } = await admin
    .from('agents')
    .select('id,name,status,config')
    .eq('id', params.agentId)
    .eq('org_id', params.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(`查询 Agent 失败：${error.message}`)
  if (!data) throw new Error('Agent 不存在或不属于当前租户')

  const row = data as { id: string; name: string; status: string; config: AgentConfig | null }
  if (row.status !== 'published') throw new Error(`Agent 状态为 ${row.status}，不可调用`)

  const cfg = row.config ?? {}

  // ── 大脑分流：与对话入口保持一致 ────────────────────────────
  if (cfg.brainMode === 'workflow' && cfg.brainWorkflowId) {
    return runWorkflowBrain(admin, {
      workflowId: cfg.brainWorkflowId,
      orgId: params.orgId,
      triggerPrompt: params.triggerPrompt,
      agentName: row.name,
    })
  }

  // routing 大脑：定时场景没有「用户这句话」可供关键词匹配，路由无从谈起。
  // 明确报错而不是悄悄退回 LLM——否则用户以为按规则路由了，其实是模型在答。
  if (cfg.brainMode === 'routing') {
    throw new Error('该 Agent 的大脑是「事项路由」，依赖用户输入的关键词匹配，不适用于定时触发；请改用工作流大脑或纯 LLM')
  }

  const systemPrompt = cfg.systemPrompt ?? `你是 ${row.name}，请执行以下任务。`
  const reply = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.triggerPrompt },
    ],
    { model: cfg.model, temperature: cfg.temperature ?? 0.5, maxTokens: 1500 },
  )
  return { reply, brain: 'llm' }
}

/**
 * 执行工作流大脑。
 *
 * ⚠️ 运行上下文的已知限制：cron 是系统触发，没有用户会话，拿不到 `RequestContext`，
 * 于是 executeGraph 会跳过**知识库检索**与**子 Agent** 两类节点（execute.ts:385/412）。
 * 这里把被跳过的节点显式回传并附在输出里，而不是让用户以为整条流程都跑过了——
 * 静默跳过会让「工作流里挂了知识库却总答不准」变成一个查不出原因的问题。
 *
 * 要彻底支持这两类节点，需给 cron 一个机器用户身份（参照 ADR-020 的
 * lib/supabase/extension-scope.ts 模式），另行排期。
 */
async function runWorkflowBrain(
  admin: ReturnType<typeof createAdminClient>,
  p: { workflowId: string; orgId: string; triggerPrompt: string; agentName: string },
): Promise<CronInvokeResult> {
  const { data, error } = await admin
    .from('workflows')
    .select('id,name,graph')
    .eq('id', p.workflowId)
    .eq('org_id', p.orgId)      // 防越权：不能跑别家租户的流程
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(`查询工作流失败：${error.message}`)
  if (!data) throw new Error('该 Agent 绑定的工作流不存在或已删除，请到编排页重新配置')

  const wf = data as { id: string; name: string; graph: PersistedGraph | null }
  const graph = wf.graph ?? { nodes: [], edges: [] }
  if (!graph.nodes?.length) throw new Error(`工作流「${wf.name}」是空的，没有可执行的节点`)

  const result = await executeGraph(graph, p.triggerPrompt)

  const skipped = result.traces.filter((t) => t.status === 'skipped').map((t) => t.nodeId)

  if (result.status !== 'succeeded') {
    const failed = result.traces.find((t) => t.status === 'failed')
    throw new Error(`工作流「${wf.name}」执行失败：${failed?.error ?? '未知错误'}`)
  }

  let reply = result.output || '（工作流执行成功但未产生输出）'
  if (skipped.length > 0) {
    reply += `\n\n⚠️ 定时执行缺少用户上下文，以下 ${skipped.length} 个节点被跳过（知识库检索 / 子 Agent 类节点）：${skipped.join('、')}。这些节点的结果未计入本次输出。`
  }
  return { reply, brain: 'workflow', skippedNodes: skipped.length ? skipped : undefined }
}
