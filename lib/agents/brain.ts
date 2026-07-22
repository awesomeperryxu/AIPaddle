import 'server-only'
import type { RequestContext } from '@/lib/context'
import { getWorkflow } from '@/lib/data/workflow'
import { getAgentDetail } from '@/lib/data/agents'

// 4.1.9/4.1.10 防环：把 workflowId 绑为 agentId 的大脑是否会成环？
// 链路：agent → workflow →（workflow 内 Agent 节点引用的 agentId'）→ 那个 agent 的大脑 workflow → …
// 若沿链路回到起点 agentId，则成环，拒绝绑定。传递性遍历 + 深度上限兜底。
export async function detectBrainCycle(
  ctx: RequestContext,
  agentId: string,
  workflowId: string,
  depth = 0,
  seenAgents: Set<string> = new Set(),
): Promise<boolean> {
  if (depth > 10) return true // 超深保守视为环
  const wf = await getWorkflow(ctx, workflowId)
  if (!wf) return false
  const nodes = Array.isArray(wf.graph?.nodes) ? (wf.graph.nodes as Array<Record<string, unknown>>) : []

  for (const nd of nodes) {
    if (nd.type !== 'agent') continue
    const data = (nd.data ?? {}) as { config?: { agentId?: unknown } }
    const refAgentId = typeof data.config?.agentId === 'string' ? data.config.agentId : undefined
    if (!refAgentId) continue
    if (refAgentId === agentId) return true // 回到起点 → 成环
    if (seenAgents.has(refAgentId)) continue
    seenAgents.add(refAgentId)
    const refAgent = await getAgentDetail(ctx, refAgentId)
    const nextWf = refAgent?.config?.brainWorkflowId
    if (nextWf && (await detectBrainCycle(ctx, agentId, nextWf, depth + 1, seenAgents))) return true
  }
  return false
}
