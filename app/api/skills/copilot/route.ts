import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createSkill, type SkillConfig } from '@/lib/data/skills'
import { listMyMcpServers } from '@/lib/data/mcp-servers'
import { writeAudit } from '@/lib/data/audit'
import { generateSkillDraft } from '@/lib/skills/copilot'

// POST /api/skills/copilot  body: { description }
// Skill Copilot（4.3.3，ADR-005）：描述→AI 生成配置草稿→落 draft。
// CP-02 AI 不能发布（createSkill 强制 draft）；CP-03 只能封装用户有权限的已审批 Server；CP-05 生成留审计。
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Skill' } }, { status: 403 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (description.length < 4) {
    return Response.json({ error: { code: 'bad_request', message: '请多描述一点需求（≥4 字）' } }, { status: 400 })
  }

  // 只把用户有权限的已审批 Server 交给生成器（CP-03：越权 Server 不进推荐清单）
  const servers = (await listMyMcpServers(ctx)).map((s) => ({ id: s.id, name: s.name }))

  let draft
  try {
    draft = await generateSkillDraft(description, servers)
  } catch (e) {
    console.error('[skill-copilot] 生成或校验失败:', e)
    return Response.json(
      { error: { code: 'generation_failed', message: 'AI 生成的配置未通过校验（或引用了越权 Server），请调整描述后重试' } },
      { status: 422 },
    )
  }

  const config: SkillConfig =
    draft.type === 'MCP' ? { mcp_server_id: draft.mcpServerId, allowed_tools: draft.allowedTools } : {}
  const skill = await createSkill(ctx, {
    name: draft.name,
    type: draft.type,
    description: draft.description,
    riskLevel: draft.riskLevel,
    config,
  })
  await writeAudit(ctx, 'skill.copilot_create', 'skill', skill.id, { description, generated: draft })

  return Response.json({ skill, draft }, { status: 201 })
}
