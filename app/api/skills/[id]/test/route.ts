import { getRequestContext } from '@/lib/context'
import { getSkillById } from '@/lib/data/skills'
import { getMcpServerById } from '@/lib/data/mcp-servers'
import { writeAudit } from '@/lib/data/audit'
import { evaluateSkillCall } from '@/lib/skills/invoke'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/skills/[id]/test  body: { tool?, input? }
// Skill 在线试跑（S3-06）。运行期强制：MCP 型只能调 allowed_tools 白名单内工具（S3-09），
// 引用的 Server 非 approved 即不可用（S3-10 运行期）。违规 → 403 + 审计留痕。
// 本版不连真实 MCP Server，通过校验后返回模拟结果（试跑语义）。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const skill = await getSkillById(ctx, id)
  if (!skill) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const requestedTool = typeof body?.tool === 'string' ? body.tool : undefined
  const allowedTools = Array.isArray(skill.config.allowed_tools) ? skill.config.allowed_tools.map(String) : []

  // MCP 型需取所引用 Server 的当前状态（判断是否被禁用）
  let serverStatus: 'draft' | 'pending' | 'approved' | 'disabled' | undefined
  if (skill.type === 'MCP') {
    const serverId = typeof skill.config.mcp_server_id === 'string' ? skill.config.mcp_server_id : ''
    const server = serverId ? await getMcpServerById(ctx, serverId) : null
    serverStatus = server?.status ?? 'disabled' // 查不到（删/无权限）等同不可用
  }

  const check = evaluateSkillCall({ type: skill.type, allowedTools, requestedTool, serverStatus })
  if (!check.ok) {
    // 越权/越界调用留审计（S3-09/S3-10）
    await writeAudit(ctx, 'skill.test.denied', 'skill', id, { code: check.code, tool: requestedTool ?? null })
    const status = check.code === 'server_disabled' ? 409 : 403
    return Response.json({ error: { code: check.code, message: check.message } }, { status })
  }

  await writeAudit(ctx, 'skill.test', 'skill', id, { tool: requestedTool ?? null })
  // 模拟试跑结果（不连真实 Server；真实执行在后续接入）
  return Response.json({
    ok: true,
    result: {
      skill: skill.name,
      type: skill.type,
      tool: requestedTool ?? null,
      echo: body?.input ?? null,
      note: '试跑（stub）：权限/白名单校验通过，未连接真实 Server',
    },
  })
}
