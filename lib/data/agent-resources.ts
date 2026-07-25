import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 4.1.11 / C道 Path B：Agent 直挂资源（知识库 / Skill / MCP Server），走统一中间表 agent_resources。
// mcp_server 类型新增于 0011，只允许绑定 status='approved' 的 MCP Server。

export type AgentResources = {
  knowledgeBaseIds: string[]
  skillIds: string[]
  mcpServerIds: string[]
  subAgentIds: string[] // 4.1.18/ADR-014：数字员工引用的子 Agent
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 读取某 Agent 直挂的知识库 / Skill / MCP Server id。 */
export async function getAgentResources(_ctx: RequestContext, agentId: string): Promise<AgentResources> {
  if (!UUID_RE.test(agentId)) return { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_resources')
    .select('resource_type,resource_id')
    .eq('agent_id', agentId)
    .in('resource_type', ['knowledge_base', 'skill', 'mcp_server', 'agent'])
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data as { resource_type: string; resource_id: string }[] | null) ?? []
  return {
    knowledgeBaseIds: rows.filter((r) => r.resource_type === 'knowledge_base').map((r) => r.resource_id),
    skillIds: rows.filter((r) => r.resource_type === 'skill').map((r) => r.resource_id),
    mcpServerIds: rows.filter((r) => r.resource_type === 'mcp_server').map((r) => r.resource_id),
    subAgentIds: rows.filter((r) => r.resource_type === 'agent').map((r) => r.resource_id),
  }
}

/** 列出本租户「数字员工」的 agent id 集合（= 引用了 ≥1 子 Agent 的 Agent，ADR-014）。
 *  供团队成员选择器只列数字员工用。RLS 隔离本租户。 */
export async function listDigitalEmployeeIds(_ctx: RequestContext): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_resources')
    .select('agent_id')
    .eq('resource_type', 'agent')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const ids = ((data as { agent_id: string }[] | null) ?? []).map((r) => r.agent_id)
  return [...new Set(ids)]
}

/** 覆盖式设置某 Agent 直挂的知识库 / Skill / MCP Server（软删旧 + 插新）。RLS 兜底租户隔离。
 *  MCP Server 必须为 approved 状态，调用方负责在允许绑定前校验（API 层校验）。 */
export async function setAgentResources(
  ctx: RequestContext,
  agentId: string,
  next: { knowledgeBaseIds: string[]; skillIds: string[]; mcpServerIds: string[]; subAgentIds?: string[] },
): Promise<AgentResources> {
  if (!UUID_RE.test(agentId)) return { knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [] }
  const supabase = await createClient()

  // 软删该 Agent 现有 kb + skill + mcp_server 关联
  const { error: delErr } = await supabase
    .from('agent_resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('agent_id', agentId)
    .in('resource_type', ['knowledge_base', 'skill', 'mcp_server', 'agent'])
    .is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)

  const kbIds = [...new Set(next.knowledgeBaseIds.filter((x) => UUID_RE.test(x)))]
  const skillIds = [...new Set(next.skillIds.filter((x) => UUID_RE.test(x)))]
  const mcpIds = [...new Set(next.mcpServerIds.filter((x) => UUID_RE.test(x)))]
  const subAgentIds = [...new Set((next.subAgentIds ?? []).filter((x) => UUID_RE.test(x) && x !== agentId))] // 不自引

  const rows = [
    ...kbIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'knowledge_base', resource_id: id })),
    ...skillIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'skill', resource_id: id })),
    ...mcpIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'mcp_server', resource_id: id })),
    ...subAgentIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'agent', resource_id: id })),
  ]
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('agent_resources').insert(rows)
    if (insErr) throw new Error(insErr.message)
  }
  return { knowledgeBaseIds: kbIds, skillIds, mcpServerIds: mcpIds, subAgentIds }
}
