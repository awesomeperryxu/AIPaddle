import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById, listAgents } from '@/lib/data/agents'
import { getAgentResources, setAgentResources } from '@/lib/data/agent-resources'
import { isDigitalEmployee, validateSubAgents } from '@/lib/agents/digital-employee'
import { createClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/agents/[id]/resources —— 读取 Agent 直挂的知识库/Skill/MCP Server（4.1.11 + Path B）。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getAgentById(ctx, id))) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ resources: await getAgentResources(ctx, id) })
}

// PUT /api/agents/[id]/resources —— 覆盖设置直挂知识库/Skill/MCP Server。权限 agent:update。
// MCP Server 绑定：只允许 status='approved' 的 Server（服务端校验，安全边界）。
export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:update')) return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Agent' } }, { status: 403 })
  const { id } = await params
  if (!(await getAgentById(ctx, id))) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const knowledgeBaseIds = Array.isArray(body?.knowledgeBaseIds) ? body.knowledgeBaseIds.map(String) : []
  const skillIds = Array.isArray(body?.skillIds) ? body.skillIds.map(String) : []
  const rawMcpIds = Array.isArray(body?.mcpServerIds) ? body.mcpServerIds.map(String) : []
  const rawSubAgentIds = Array.isArray(body?.subAgentIds) ? body.subAgentIds.map(String) : []

  // 校验每个 MCP Server 均为 approved 状态（安全边界：平台管理员已确认的才能绑定）
  let mcpServerIds: string[] = []
  if (rawMcpIds.length > 0) {
    const supabase = await createClient()
    const { data: approved } = await supabase
      .from('mcp_servers')
      .select('id')
      .in('id', rawMcpIds)
      .eq('status', 'approved')
      .is('deleted_at', null)
    mcpServerIds = (approved as { id: string }[] ?? []).map((r) => r.id)
    const denied = rawMcpIds.filter((mcpId: string) => !mcpServerIds.includes(mcpId))
    if (denied.length > 0) {
      return Response.json(
        { error: { code: 'mcp_not_approved', message: `以下 MCP Server 未经平台审批，无法绑定：${denied.join(', ')}` } },
        { status: 422 },
      )
    }
  }

  // 子 Agent（数字员工，4.1.18 / ADR-014）：服务端裁定授权集 + 数字员工判定，不信前端。
  let subAgentIds: string[] = []
  let subAgentRejected: { id: string; reason: string }[] = []
  if (rawSubAgentIds.length > 0) {
    // 授权集：本租户全部 Agent（RLS 已隔离）——同租户可对话，视为有 agent:chat 权限。
    const authorizedIds = new Set((await listAgents(ctx)).map((a) => a.id))
    // 数字员工判定：候选中本身引用了子 Agent 的（嵌套仅 1 层，须拒）。
    const digitalEmployeeIds = new Set<string>()
    for (const cid of [...new Set(rawSubAgentIds as string[])]) {
      const res = await getAgentResources(ctx, cid)
      if (isDigitalEmployee(res.subAgentIds)) digitalEmployeeIds.add(cid)
    }
    const { accepted, rejected } = validateSubAgents({
      selfId: id,
      candidateIds: rawSubAgentIds,
      authorizedIds,
      digitalEmployeeIds,
    })
    subAgentIds = accepted
    subAgentRejected = rejected
  }

  const resources = await setAgentResources(ctx, id, { knowledgeBaseIds, skillIds, mcpServerIds, subAgentIds })
  return Response.json({ resources, subAgentRejected })
}
