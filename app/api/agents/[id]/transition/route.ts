import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionAgent } from '@/lib/data/agents'
import { recordSubmission, recordReviewDecision } from '@/lib/data/reviews'
import { writeAudit } from '@/lib/data/audit'
import { TRANSITIONS, type TransitionAction } from '@/lib/agents/status'
import { getDigitalEmployeeDetail } from '@/lib/data/digital-employee'
import { checkDigitalEmployee, summarizeDeReadiness } from '@/lib/agents/de-readiness'
import { listDependentDigitalEmployees, offlineDigitalEmployees } from '@/lib/data/de-dependents'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

// POST /api/agents/[id]/transition  body: { action }
// 状态机流转（4.1.2）：按动作查所需权限；非法流转（当前态 ≠ from）→ 409。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as TransitionAction
  const t = TRANSITIONS[action]
  if (!t) {
    return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  }
  if (!can(ctx, t.action)) {
    return Response.json(
      { error: { code: 'forbidden', message: `无权限：${action}` } },
      { status: 403 },
    )
  }
  const { id } = await params

  // ── DE-7：发布门槛（AC-08b）────────────────────────────────────────
  // 数字员工自身 published 不代表跑得起来——活干在下级身上。
  // 下级是草稿/已下线/已删除就拒绝发布，并指出**具体是哪一个**。
  // 只拦 approve / online 这两个「让它上线」的动作；submit/reject/offline 不拦。
  if (action === 'approve' || action === 'online') {
    const detail = await getDigitalEmployeeDetail(ctx, id)
    if (detail) {
      const report = checkDigitalEmployee(
        detail.subAgents.map((s) => ({ id: s.id, name: s.name, status: s.status })),
        detail.missingSubAgentIds,
        detail.subAgents.length > 0 || detail.missingSubAgentIds.length > 0,
      )
      if (!report.ready) {
        return Response.json(
          {
            error: {
              code: 'sub_agent_not_ready',
              message: `无法发布：${summarizeDeReadiness(report)}。请先让这些下级 Agent 上线。`,
            },
            issues: report.issues,
          },
          { status: 409 },
        )
      }
    }
  }

  // ── DE-8：下线联动（AC-08c）────────────────────────────────────────
  // 下线一个被引用的 Agent，会让引用它的数字员工静默跑不通。
  // 照搬 Tool 下线那套：先回 409 + 受影响清单，用户确认后带 confirm 再来，
  // 确认时把这些上级一并置为下线——不留「上级还挂着已下线的下级」这种半坏状态。
  //
  // 🔴 恢复时**不自动拉起上级**，只解除封锁，由人重新发布（ADR-026 §5）：
  // 上级可能已因别的原因被人为下线，自动拉起会覆盖人的决定。
  let cascaded: string[] = []
  if (action === 'offline') {
    const deps = (await listDependentDigitalEmployees(ctx, id)).filter(
      (d) => d.status === 'published',
    )
    if (deps.length > 0) {
      if (body?.confirm !== true) {
        return Response.json(
          {
            error: {
              code: 'has_dependents',
              message: `有 ${deps.length} 个已发布的数字员工正把它当下级使用，下线后它们将无法完整运行，会被一并下线。确认请重新提交并带 confirm=true。`,
            },
            affectedDigitalEmployees: deps,
          },
          { status: 409 },
        )
      }
      cascaded = deps.map((d) => d.id)
    }
  }

  const result = await transitionAgent(ctx, id, action)
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }

  // 4.1.3：审批记录 + 审计留痕（状态已落库，记录失败只记日志不回滚）
  try {
    if (action === 'submit') await recordSubmission(ctx, id)
    else if (action === 'approve') await recordReviewDecision(ctx, id, 'approved')
    else if (action === 'reject') await recordReviewDecision(ctx, id, 'rejected')
  } catch (e) {
    console.error('[review] 审批记录写入失败:', action, e)
  }
  // 联动下线上级——放在本体流转成功之后，避免"上级下了、自己没下"的错位
  let cascadedCount = 0
  if (cascaded.length > 0) {
    cascadedCount = await offlineDigitalEmployees(ctx, cascaded)
    await writeAudit(ctx, 'agent.offline.cascade', 'agent', id, {
      affected: cascaded,
      count: cascadedCount,
    })
  }

  await writeAudit(ctx, `agent.${action}`, 'agent', id, { to: t.to })

  return Response.json({ agent: result.agent, cascadedOffline: cascadedCount })
}
