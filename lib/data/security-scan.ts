import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { scanResource, type ScanResult, type ScanTarget } from '@/lib/security/scanners'

// SEC-1/SEC-2：把待审资源的真实配置组装成扫描输入，交给纯函数引擎判定。
// 数据层只负责取数与拼装，判定规则全在 lib/security/scanners.ts（可单测、无 IO）。

type AgentRow = { id: string; name: string; config: Record<string, unknown> | null }

/**
 * 扫描一个待审资源。
 *
 * 🔴 走请求级客户端（RLS 生效）：审核者只能扫本租户的资源。
 * 用 admin client 会让「审核」变成一条跨租户读取任意 Agent 提示词的旁路。
 */
export async function scanReviewTarget(
  ctx: RequestContext,
  resourceType: 'agent' | 'skill' | 'workflow',
  resourceId: string,
): Promise<ScanResult | null> {
  if (resourceType === 'agent') {
    const t = await buildAgentTarget(ctx, resourceId)
    return t ? scanResource(t) : null
  }
  if (resourceType === 'skill') {
    const t = await buildSkillTarget(resourceId)
    return t ? scanResource(t) : null
  }
  // workflow 的可扫描面（节点配置）与 Agent 差异大，本期不覆盖，返回 null 由 UI 标注
  return null
}

async function buildAgentTarget(ctx: RequestContext, agentId: string): Promise<ScanTarget | null> {
  const supabase = await createClient()
  const { data: agent } = await supabase
    .from('agents').select('id,name,config')
    .eq('id', agentId).eq('org_id', ctx.orgId).is('deleted_at', null)
    .maybeSingle()
  if (!agent) return null

  const cfg = ((agent as AgentRow).config ?? {}) as Record<string, unknown>
  const vars = Array.isArray(cfg.variables) ? (cfg.variables as { key?: string }[]) : []

  // 挂载资源：知识库计数 + Skill/MCP/Tool 明细（用于组合风险与依赖过审判断）
  const { data: res } = await supabase
    .from('agent_resources').select('resource_type,resource_id').eq('agent_id', agentId)
  const rows = (res as { resource_type: string; resource_id: string }[] | null) ?? []
  const skillIds = rows.filter((r) => r.resource_type === 'skill').map((r) => r.resource_id)
  const mcpIds = rows.filter((r) => r.resource_type === 'mcp_server').map((r) => r.resource_id)
  const toolIds = rows.filter((r) => r.resource_type === 'tool').map((r) => r.resource_id)
  const kbCount = rows.filter((r) => r.resource_type === 'knowledge_base').length

  const [skills, mcps, tools] = await Promise.all([
    skillIds.length
      ? supabase.from('skills').select('id,name,type,status,config').in('id', skillIds)
      : Promise.resolve({ data: [] }),
    mcpIds.length
      ? supabase.from('mcp_servers').select('id,name,status').in('id', mcpIds)
      : Promise.resolve({ data: [] }),
    toolIds.length
      ? supabase.from('tools').select('id,name,kind').in('id', toolIds)
      : Promise.resolve({ data: [] }),
  ])

  type SkillRow = { id: string; name: string; type: string | null; status: string | null; config: Record<string, unknown> | null }
  return {
    resourceType: 'agent',
    systemPrompt: typeof cfg.systemPrompt === 'string' ? cfg.systemPrompt : null,
    openingStatement: typeof cfg.openingStatement === 'string' ? cfg.openingStatement : null,
    variableKeys: vars.map((v) => v?.key).filter((k): k is string => !!k),
    moderationEnabled: cfg.moderationEnabled === true,
    maxIterations: typeof cfg.maxIterations === 'number' ? cfg.maxIterations : undefined,
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : undefined,
    resources: {
      knowledgeBaseCount: kbCount,
      skills: ((skills.data as SkillRow[] | null) ?? []).map((s) => {
        const c = (s.config ?? {}) as Record<string, unknown>
        return {
          id: s.id, name: s.name, type: s.type ?? undefined, status: s.status ?? undefined,
          // DB 型的只读/白名单配置：字段缺失按「未配置」处理，即命中——
          // 默认拒绝优于默认放行，PRD 2.5.3 是强制要求
          readOnly: s.type === 'DB' ? c.readOnly === true : undefined,
          hasTableWhitelist: s.type === 'DB'
            ? Array.isArray(c.tableWhitelist) && (c.tableWhitelist as unknown[]).length > 0
            : undefined,
        }
      }),
      mcpServers: ((mcps.data as { id: string; name: string; status: string | null }[] | null) ?? [])
        .map((m) => ({ id: m.id, name: m.name, status: m.status ?? undefined })),
      tools: ((tools.data as { id: string; name: string; kind: string | null }[] | null) ?? [])
        .map((x) => ({ id: x.id, name: x.name, kind: x.kind ?? undefined })),
    },
  }
}

async function buildSkillTarget(skillId: string): Promise<ScanTarget | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('skills').select('id,name,type,status,config,documentation')
    .eq('id', skillId).is('deleted_at', null)
    .maybeSingle()
  if (!data) return null
  const s = data as { id: string; name: string; type: string | null; status: string | null; config: Record<string, unknown> | null; documentation: string | null }
  const c = (s.config ?? {}) as Record<string, unknown>
  return {
    resourceType: 'skill',
    // Prompt 型 Skill 的提示词就在 config.prompt；其余类型扫文档，凭证常被贴在示例里
    systemPrompt: typeof c.prompt === 'string' ? c.prompt : s.documentation,
    resources: {
      skills: [{
        id: s.id, name: s.name, type: s.type ?? undefined, status: s.status ?? undefined,
        readOnly: s.type === 'DB' ? c.readOnly === true : undefined,
        hasTableWhitelist: s.type === 'DB'
          ? Array.isArray(c.tableWhitelist) && (c.tableWhitelist as unknown[]).length > 0
          : undefined,
      }],
    },
  }
}
