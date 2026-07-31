import { guardExtensionRequest, corsHeaders, handleOptions } from '@/lib/auth/extension-guard'
import { withExtensionIdentity } from '@/lib/auth/extension-context'
import { createLead, LeadValidationError } from '@/lib/data/leads'
import { sendLeadNotification, LEAD_SOURCE } from '@/lib/notify'

// V12-8.9 / ADR-020：转人工。
//
// 与 /leads 的差别只在**紧急程度与语义**，不在数据结构——访客点「转人工顾问」时
// 同样是留下联系方式等回电，所以复用 leads 表，用 source 区分来源，
// 避免为同一件事建两套结构（将来统计"线索总量"还得 union 两张表）。
//
// POST /api/ext/v1/handoff  需 handoff scope

export const runtime = 'nodejs'

export async function OPTIONS(req: Request) {
  return handleOptions(req, [])
}

export async function POST(req: Request) {
  const guard = await guardExtensionRequest(req, 'handoff')
  if ('response' in guard) return guard.response
  const { ctx, origin } = guard
  const cors = corsHeaders(origin, ctx.allowedOrigins)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

  const payload = {
    name: str(body.name) ?? '',
    contact: str(body.contact) ?? '',
    project: str(body.project),
    expectedTime: str(body.expectedTime),
    siteInfo: str(body.siteInfo),
    source: LEAD_SOURCE.handoff,
    conversationSummary: str(body.summary),
  }

  try {
    const lead = await withExtensionIdentity(ctx, () =>
      createLead(ctx.request, {
        extensionId: ctx.extensionId,
        conversationId: str(body.conversationId) ?? null,
        ...payload,
        summary: payload.conversationSummary,
        clientIp: req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
        raw: body,
      }),
    )

    const notify = await withExtensionIdentity(ctx, () =>
      sendLeadNotification(ctx.request, payload, { leadId: lead.id }),
    ).catch(() => ({ email: false, wecom: false, deliveries: [] }))

    return Response.json(
      { id: lead.id, received: true, notified: { email: notify.email, wecom: notify.wecom } },
      { status: 201, headers: cors },
    )
  } catch (e) {
    if (e instanceof LeadValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400, headers: cors })
    }
    console.error('[ext/handoff] 转人工失败:', e)
    return Response.json(
      { error: { code: 'internal', message: '提交失败，请稍后重试' } },
      { status: 500, headers: cors },
    )
  }
}
