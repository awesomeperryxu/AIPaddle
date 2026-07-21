import 'server-only'
import type { RequestContext } from '@/lib/context'
import type { WorkflowGraph, GraphError } from '@/lib/workflow/validate'
import { getSkillById } from '@/lib/data/skills'

// 4.4.2 + ADR-004：Tool 节点只能引用【已发布】Skill，且禁止直连 MCP。
// 需查库（哪个 skill 已发布），故为 async，与纯结构校验 validateGraph 分开。

// 直连 MCP 的可疑字段——出现即拒（Tool 节点必须经 Skill，无直连 MCP 入口）
const MCP_DIRECT_KEYS = ['mcp_server_id', 'mcp_server', 'server_url', 'mcp', 'endpoint']

type GNode = { id: string; type: string; data?: { config?: Record<string, unknown> } }

export async function validateToolNodes(ctx: RequestContext, graph: WorkflowGraph): Promise<GraphError[]> {
  const errors: GraphError[] = []
  const nodes = (graph?.nodes ?? []) as GNode[]
  const toolNodes = nodes.filter((n) => n.type === 'tool')
  if (toolNodes.length === 0) return errors

  for (const n of toolNodes) {
    const cfg = (n.data?.config ?? {}) as Record<string, unknown>

    // ① 禁止直连 MCP（ADR-004：无直连 MCP 入口）
    const direct = MCP_DIRECT_KEYS.find((k) => cfg[k] != null && cfg[k] !== '')
    if (direct) {
      errors.push({ code: 'mcp_direct', message: `Tool 节点（${n.id}）禁止直连 MCP（字段 ${direct}）——必须引用已发布 Skill`, nodeId: n.id })
      continue
    }

    // ② 必须引用一个 skill（tool_id）
    const skillId = typeof cfg.tool_id === 'string' ? cfg.tool_id : (typeof cfg.skill_id === 'string' ? cfg.skill_id : '')
    if (!skillId) {
      errors.push({ code: 'tool_no_skill', message: `Tool 节点（${n.id}）未选择 Skill`, nodeId: n.id })
      continue
    }

    // ③ 该 skill 必须存在且【已发布】（RLS 只查本租户）
    const skill = await getSkillById(ctx, skillId)
    if (!skill) {
      errors.push({ code: 'tool_skill_missing', message: `Tool 节点（${n.id}）引用的 Skill 不存在或无权访问`, nodeId: n.id })
    } else if (skill.status !== 'published') {
      errors.push({ code: 'tool_skill_unpublished', message: `Tool 节点（${n.id}）引用的 Skill「${skill.name}」未发布（当前 ${skill.status}）`, nodeId: n.id })
    }
  }
  return errors
}
