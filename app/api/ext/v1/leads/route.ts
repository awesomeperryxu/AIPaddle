import { guardExtensionRequest, corsHeaders, handleOptions } from '@/lib/auth/extension-guard'
import { withExtensionIdentity } from '@/lib/auth/extension-context'
import { createLead, LeadValidationError } from '@/lib/data/leads'
import { sendLeadNotification } from '@/lib/notify'

// V12-8.9 / ADR-020：外部留资提交。
// 🔴 本文件禁止 import getRequestContext（内外身份入口分家，ADR-020 §2）
// 🔴 本文件不实现任何发信逻辑——只调用 lib/notify 交付的 sendLeadNotification
//    （PARALLEL_COORDINATION_v113 §5 邮件道/X 道交界契约）
//
// POST /api/ext/v1/leads
//   Header: Authorization: Bearer <api key>（需 leads scope）
//   Body:   { name, contact, project?, expectedTime?, siteInfo?, conversationId?, summary? }

export const runtime = 'nodejs'

export async function OPTIONS(req: Request) {
  return handleOptions(req, [])
}

export async function POST(req: Request) {
  const guard = await guardExtensionRequest(req, 'leads')
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
    source: str(body.source),
    conversationSummary: str(body.summary),
  }

  try {
    // 入库在机器用户身份下进行 → org_id 由 RLS 兜底，前端传什么租户都不作数
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

    // 🔴 通知失败绝不影响留资结果：线索已经入库，销售还能从后台看到；
    // 若这里因通知异常而回 500，官网会提示用户"提交失败"、诱导重复提交，反而更糟。
    const notify = await withExtensionIdentity(ctx, () =>
      sendLeadNotification(ctx.request, payload, { leadId: lead.id }),
    ).catch(() => ({ email: false, wecom: false, deliveries: [] }))

    return Response.json(
      {
        id: lead.id,
        // 只回执必要字段，不回显 raw（含原始提交体）
        received: true,
        notified: { email: notify.email, wecom: notify.wecom },
      },
      { status: 201, headers: cors },
    )
  } catch (e) {
    if (e instanceof LeadValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400, headers: cors })
    }
    console.error('[ext/leads] 留资失败:', e)
    return Response.json(
      { error: { code: 'internal', message: '提交失败，请稍后重试' } },
      { status: 500, headers: cors },
    )
  }
}
