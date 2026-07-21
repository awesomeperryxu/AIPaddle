import { getRequestContext } from '@/lib/context'
import { getSkillById } from '@/lib/data/skills'
import { getMcpServerById } from '@/lib/data/mcp-servers'
import { writeAudit } from '@/lib/data/audit'
import { evaluateSkillCall } from '@/lib/skills/invoke'

type Body = { skillId?: string; filename?: string; tool?: string }

// POST /api/office/writeback —— 办公文件处理·通道②（4.3.4，ADR-006/ADR-004）。
// 把处理后的文件经「微盘写入」类 MCP Skill 写回企业云盘。复用运行期权限机制：
// - DOC-04 写入权限切面：只有 allowed_tools 含写工具的 Skill 才能写回；只读切面写操作被拒 + 审计。
// - DOC-05：引用的云盘 MCP Server 未审批/被禁用即不可用（getMcpServerById + evaluateSkillCall）。
// 本版不连真实微盘，校验通过后返回 stub 写回结果。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Body
  const skillId = typeof body.skillId === 'string' ? body.skillId : ''
  const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
  const tool = typeof body.tool === 'string' && body.tool.trim() ? body.tool.trim() : 'write'
  if (!skillId) return Response.json({ error: { code: 'invalid', message: '缺少写回用的 Skill' } }, { status: 400 })
  if (!filename) return Response.json({ error: { code: 'invalid', message: '缺少文件名' } }, { status: 400 })

  const skill = await getSkillById(ctx, skillId)
  if (!skill) return Response.json({ error: { code: 'not_found', message: '写回 Skill 不存在' } }, { status: 404 })

  const allowedTools = Array.isArray(skill.config.allowed_tools) ? skill.config.allowed_tools.map(String) : []
  let serverStatus: 'draft' | 'pending' | 'approved' | 'disabled' | undefined
  if (skill.type === 'MCP') {
    const serverId = typeof skill.config.mcp_server_id === 'string' ? skill.config.mcp_server_id : ''
    const server = serverId ? await getMcpServerById(ctx, serverId) : null
    serverStatus = server?.status ?? 'disabled'
  }

  // 写入权限切面校验（DOC-04）：写工具须在该 Skill 的 allowed_tools 白名单内
  const check = evaluateSkillCall({ type: skill.type, allowedTools, requestedTool: tool, serverStatus })
  if (!check.ok) {
    await writeAudit(ctx, 'office.writeback.denied', 'skill', skillId, { code: check.code, tool, filename })
    const status = check.code === 'server_disabled' ? 409 : 403
    return Response.json({ error: { code: check.code, message: check.message } }, { status })
  }

  await writeAudit(ctx, 'office.writeback', 'skill', skillId, { tool, filename })
  return Response.json({
    ok: true,
    result: { skill: skill.name, tool, filename, note: '写回（stub）：写入权限校验通过，未连接真实云盘' },
  })
}
