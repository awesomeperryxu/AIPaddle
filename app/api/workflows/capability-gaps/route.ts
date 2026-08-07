import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSkills, createSkill } from '@/lib/data/skills'
import { listMcpServers } from '@/lib/data/mcp-servers'
import { generateSkillDraft } from '@/lib/skills/copilot'
import { findCapabilityGaps, resolveGaps } from '@/lib/workflow/capability-gap'
import { writeAudit } from '@/lib/data/audit'

// POST /api/workflows/capability-gaps —— 能力缺口分析与补齐（WF-17，find-skill）
//
// action=analyze：这张图差哪些能力，本租户已有资产里有没有能顶上的候选
// action=draft-skill：为某个缺口起草一个 Skill（**draft 态**）
//
// 🔴 边界：不联网拉取、不自动安装、不自动发布。
// 起草出来的 Skill 一律 draft，要用还得人工提交审核（submitSkill）——
// 这是 ADR-005「AI 只产 draft」与 SEC-1/2/3 上架审核的既定门槛，不在这里开口子。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const action = String(body?.action ?? 'analyze')

  if (action === 'analyze') {
    if (!can(ctx, 'workflow:create')) {
      return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
    }
    const graph = body?.graph && typeof body.graph === 'object' ? (body.graph as { nodes?: unknown[] }) : { nodes: [] }
    const gaps = findCapabilityGaps(graph as never)
    if (gaps.length === 0) return Response.json({ resolutions: [] })

    const [skills, mcpServers] = await Promise.all([listSkills(ctx), listMcpServers(ctx)])
    const resolutions = resolveGaps(gaps, {
      // 草稿 Skill 也列出来——用户可能刚起草过一个正合适的，只是还没提审
      skills: skills.map((s) => ({ id: s.id, name: s.name, description: s.description, status: s.status, type: s.type })),
      mcpServers: mcpServers.map((m) => ({ id: m.id, name: m.name, description: m.description })),
    })
    return Response.json({ resolutions })
  }

  if (action === 'draft-skill') {
    // 起草即写库，按创建 Skill 判权
    if (!can(ctx, 'skill:create')) {
      return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Skill' } }, { status: 403 })
    }
    const need = String(body?.need ?? '').trim()
    const context = String(body?.context ?? '').trim()
    if (!need) return Response.json({ error: { code: 'invalid', message: '缺少能力描述' } }, { status: 400 })

    const servers = (await listMcpServers(ctx)).map((m) => ({ id: m.id, name: m.name }))
    try {
      const draft = await generateSkillDraft(
        `需要一个「${need}」能力，用于工作流步骤：${context || need}。请给出可落地的 Skill 定义。`,
        servers,
      )
      const created = await createSkill(ctx, {
        name: draft.name,
        type: draft.type,
        description: draft.description,
        riskLevel: draft.riskLevel,
        config: { mcp_server_id: draft.mcpServerId || undefined, allowed_tools: draft.allowedTools },
        documentation: `由 AI 依据工作流缺口「${need}」自动起草。使用前请补齐凭证与调用参数，并提交审核。`,
      })
      await writeAudit(ctx, 'skill.copilot_created', 'skill', created.id, {
        name: created.name, description: need, need, ready: false, readinessIssues: 1,
      })
      return Response.json({ skill: created }, { status: 201 })
    } catch (e) {
      const message = e instanceof Error ? e.message : '起草失败'
      await writeAudit(ctx, 'skill.copilot_failed', 'skill', '-', { description: need, success: false, error: message })
      return Response.json({ error: { code: 'draft_failed', message } }, { status: 422 })
    }
  }

  return Response.json({ error: { code: 'invalid', message: '未知操作' } }, { status: 400 })
}
