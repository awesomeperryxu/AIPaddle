import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionSkill, submitSkill } from '@/lib/data/skills'
import { writeAudit } from '@/lib/data/audit'
import { TRANSITIONS, type SkillTransitionAction } from '@/lib/skills/status'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/skills/[id]/transition  body: { action: submit|approve|reject }
// 发布状态机（S3-02）：按动作查权限；非法流转（当前态 ≠ from）→ 409。
// submit 走风险分级（S3-04）：低风险自动发布、中/高风险进 pending 待审。approve/reject=Admin/Auditor。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as SkillTransitionAction
  const t = TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }
  const { id } = await params

  if (action === 'submit') {
    const r = await submitSkill(ctx, id)
    if (!r.ok) {
      if (r.reason === 'not_found')
        return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
      return Response.json(
        { error: { code: 'illegal_transition', message: '非法流转：仅草稿可提交' } },
        { status: 409 },
      )
    }
    await writeAudit(ctx, 'skill.submit', 'skill', id, { to: r.skill.status, auto: r.auto })
    return Response.json({ skill: r.skill, autoPublished: r.auto })
  }

  const result = await transitionSkill(ctx, id, action)
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  await writeAudit(ctx, `skill.${action}`, 'skill', id, { to: t.to })
  return Response.json({ skill: result.skill })
}
