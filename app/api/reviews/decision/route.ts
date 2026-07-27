import { getRequestContext } from '@/lib/context'
import { can, type Action } from '@/lib/auth/permissions'
import { recordReviewDecision, type ReviewType } from '@/lib/data/reviews'
import { writeAudit } from '@/lib/data/audit'

// POST /api/reviews/decision  body: { resourceId, decision, resourceType?, comments? }
// 安全审批裁决（4.1.3）：按资源类型取对应 :review 权限（agent/workflow→agent:review，skill→skill:review）。
// recordReviewDecision 按 resource_id + type 更新最近的 pending 记录，故端点入参用 resourceId + resourceType。
const VALID_TYPES: ReviewType[] = ['agent', 'skill', 'workflow']

function reviewAction(type: ReviewType): Action {
  return type === 'skill' ? 'skill:review' : 'agent:review'
}

export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const rawType = body?.resourceType
  const resourceType: ReviewType = VALID_TYPES.includes(rawType as ReviewType)
    ? (rawType as ReviewType)
    : 'agent'

  if (!can(ctx, reviewAction(resourceType))) {
    return Response.json(
      { error: { code: 'forbidden', message: '无权限审批' } },
      { status: 403 },
    )
  }

  const decision = body?.decision
  if (decision !== 'approved' && decision !== 'rejected') {
    return Response.json(
      { error: { code: 'bad_request', message: '非法裁决，只能为 approved / rejected' } },
      { status: 400 },
    )
  }
  const resourceId = body?.resourceId
  if (typeof resourceId !== 'string' || !resourceId) {
    return Response.json(
      { error: { code: 'bad_request', message: '缺少 resourceId' } },
      { status: 400 },
    )
  }
  const comments = typeof body?.comments === 'string' && body.comments ? body.comments : undefined

  await recordReviewDecision(ctx, resourceId, decision, comments, resourceType)
  await writeAudit(
    ctx,
    `${resourceType}.${decision === 'approved' ? 'approve' : 'reject'}`,
    resourceType,
    resourceId,
    { decision },
  )

  return Response.json({ ok: true })
}
