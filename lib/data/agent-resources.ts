import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 4.1.11：Agent 直挂资源（知识库 / Skill），走统一中间表 agent_resources。
// 与 knowledge.ts 的 setKbAgents（KB 侧入口）互补——这里是 Agent 侧入口。

export type AgentResources = { knowledgeBaseIds: string[]; skillIds: string[] }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 读取某 Agent 直挂的知识库 / Skill id。 */
export async function getAgentResources(_ctx: RequestContext, agentId: string): Promise<AgentResources> {
  if (!UUID_RE.test(agentId)) return { knowledgeBaseIds: [], skillIds: [] }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_resources')
    .select('resource_type,resource_id')
    .eq('agent_id', agentId)
    .in('resource_type', ['knowledge_base', 'skill'])
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data as { resource_type: string; resource_id: string }[] | null) ?? []
  return {
    knowledgeBaseIds: rows.filter((r) => r.resource_type === 'knowledge_base').map((r) => r.resource_id),
    skillIds: rows.filter((r) => r.resource_type === 'skill').map((r) => r.resource_id),
  }
}

/** 覆盖式设置某 Agent 直挂的知识库 / Skill（软删旧 + 插新）。RLS 兜底租户隔离。 */
export async function setAgentResources(
  ctx: RequestContext,
  agentId: string,
  next: { knowledgeBaseIds: string[]; skillIds: string[] },
): Promise<AgentResources> {
  if (!UUID_RE.test(agentId)) return { knowledgeBaseIds: [], skillIds: [] }
  const supabase = await createClient()
  // 软删该 Agent 现有 kb+skill 关联
  const { error: delErr } = await supabase
    .from('agent_resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('agent_id', agentId)
    .in('resource_type', ['knowledge_base', 'skill'])
    .is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)

  const kbIds = [...new Set(next.knowledgeBaseIds.filter((x) => UUID_RE.test(x)))]
  const skillIds = [...new Set(next.skillIds.filter((x) => UUID_RE.test(x)))]
  const rows = [
    ...kbIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'knowledge_base', resource_id: id })),
    ...skillIds.map((id) => ({ org_id: ctx.orgId, agent_id: agentId, resource_type: 'skill', resource_id: id })),
  ]
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('agent_resources').insert(rows)
    if (insErr) throw new Error(insErr.message)
  }
  return { knowledgeBaseIds: kbIds, skillIds }
}
