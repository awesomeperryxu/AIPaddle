import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionTool } from '@/lib/data/tools'
import { TOOL_TRANSITIONS, type PluginTransitionAction } from '@/lib/plugins/status'
import { writeAudit } from '@/lib/data/audit'
import { listSkillsDependingOn } from '@/lib/data/skill-dependencies'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as PluginTransitionAction
  const t = TOOL_TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }

  const { id } = await params

  // 🔴 V12-3.6 / AC-17：下线前先告知影响面。
  //
  // Tool 下线会让依赖它的 Skill 无法运行。若默默下线，用户要等到线上报错才知道
  // 出了什么事，而报错信息里通常看不出「是某个 Tool 被下线了」。
  // 故：有已发布的 Skill 依赖时，第一次请求返回 409 + 受影响清单；
  // 调用方确认后带 confirm:true 再来，才真正执行。
  //
  // 只拦已发布的 Skill——草稿态的本就跑不起来，拦它只会让人以为下线被无故阻止。
  if (action === 'offline') {
    const confirmed = body?.confirm === true
    const dependents = await listSkillsDependingOn(ctx, 'tool', id)
    const publishedDeps = dependents.filter((d) => d.skillStatus === 'published')
    if (publishedDeps.length > 0 && !confirmed) {
      return Response.json(
        {
          error: {
            code: 'has_dependents',
            message: `有 ${publishedDeps.length} 个已发布的 Skill 正依赖此 Tool，下线后它们将无法运行。确认要下线请重新提交并带 confirm=true。`,
          },
          affectedSkills: publishedDeps,
        },
        { status: 409 },
      )
    }
  }

  const r = await transitionTool(ctx, id, action)
  if (!r.ok) {
    if (r.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  // Tool 下线要阻断依赖它的资产的新运行（AC-17），流转必须留痕
  // 下线的审计要记下影响了谁——事后追查「这个 Skill 什么时候开始不能用的」时，
  // 只有状态变更时间是不够的
  const auditDetail: Record<string, unknown> = { to: r.status }
  if (action === 'offline') {
    const affected = await listSkillsDependingOn(ctx, 'tool', id)
    if (affected.length > 0) auditDetail.affectedSkills = affected.map((a) => a.skillName)
  }
  await writeAudit(ctx, `tool.${action}`, 'tool', id, auditDetail)
  return Response.json({ status: r.status })
}
