import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSkills, createSkill, type SkillConfig, type RiskLevel } from '@/lib/data/skills'
import { isSkillType } from '@/lib/skills/status'
import { listMyMcpServers } from '@/lib/data/mcp-servers'

// GET /api/skills —— 列出本租户 Skill（RLS 隔离，登录即可读）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const skills = await listSkills(ctx)
  return Response.json({ skills })
}

// POST /api/skills —— 创建 Skill。权限 skill:create（Admin/Developer）。
// 类型严格校验（S3-01）；MCP 型必须封装一个「本人可见的已审批 MCP Server」（S3-09 封装侧）：
// 引用不在 my_mcp_servers（未审批/无权限角色部门）→ 422。创建一律 draft。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Skill' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  if (!isSkillType(body?.type)) {
    return Response.json(
      { error: { code: 'invalid', message: '类型必须是 MCP/API/DB/Workflow/Prompt 之一' } },
      { status: 400 },
    )
  }
  const type = body.type
  const config: SkillConfig = body?.config && typeof body.config === 'object' ? (body.config as SkillConfig) : {}

  // MCP 型封装校验（S3-09）：必须引用一个本人可见的已审批 Server
  if (type === 'MCP') {
    const serverId = typeof config.mcp_server_id === 'string' ? config.mcp_server_id : ''
    if (!serverId) {
      return Response.json({ error: { code: 'invalid', message: 'MCP 型 Skill 必须封装一个 MCP Server' } }, { status: 400 })
    }
    const mine = await listMyMcpServers(ctx)
    if (!mine.some((s) => s.id === serverId)) {
      return Response.json(
        { error: { code: 'invalid_mcp_ref', message: '引用的 MCP Server 不存在、未审批或无权限' } },
        { status: 422 },
      )
    }
  }

  const riskLevel: RiskLevel | undefined = ['low', 'medium', 'high'].includes(String(body?.riskLevel))
    ? (body.riskLevel as RiskLevel)
    : undefined
  const skill = await createSkill(ctx, {
    name,
    type,
    description: typeof body?.description === 'string' ? body.description : undefined,
    documentation: typeof body?.documentation === 'string' ? body.documentation : undefined,
    riskLevel,
    tags: Array.isArray(body?.tags) ? body.tags.map(String) : undefined,
    config,
  })
  return Response.json({ skill }, { status: 201 })
}
