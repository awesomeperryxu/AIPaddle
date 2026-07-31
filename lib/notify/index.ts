import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { sendWecomLead } from './wecom'
import { sendEmailLead } from './email'
import type { LeadPayload, NotifyResult } from './types'

export type { LeadPayload, NotifyResult, ChannelResult } from './types'

// V12-4.8（邮件道）：对外交付的唯一入口，契约见 PARALLEL_COORDINATION_v113 §5。
// X 道在 /api/ext/v1/leads 与 /handoff 里调用本函数，不自己实现发信。

/**
 * 投递留资通知（企微 + 邮件并行）。
 *
 * 🔴 两条通道互不阻塞、互不影响：一条挂了另一条照发。销售能收到一条是一条，
 * 总比"因为邮件服务器抽风导致企微也没发"要好。
 * 🔴 本函数**从不抛异常**——通知失败绝不能让留资入库回滚。线索比通知值钱得多。
 */
export async function sendLeadNotification(
  ctx: RequestContext,
  lead: LeadPayload,
  opts: { leadId?: string } = {},
): Promise<NotifyResult> {
  const [wecom, email] = await Promise.all([
    sendWecomLead(lead).catch(e => ({
      success: false, errorCode: 'exception', errorDetail: String(e).slice(0, 200), latencyMs: 0,
    })),
    sendEmailLead(lead).catch(e => ({
      success: false, errorCode: 'exception', errorDetail: String(e).slice(0, 200), latencyMs: 0,
    })),
  ])

  const deliveries = [
    { channel: 'wecom' as const, ...wecom },
    { channel: 'email' as const, ...email },
  ]

  // 逐条落库：部分失败必须可查，否则销售不知该不该等、运维不知该不该补发
  if (opts.leadId) {
    try {
      const supabase = await createClient()
      await supabase.from('notification_deliveries').insert(
        deliveries.map(d => ({
          org_id: ctx.orgId,
          lead_id: opts.leadId,
          channel: d.channel,
          target: d.target ?? null,
          success: d.success,
          error_code: d.errorCode ?? null,
          // 只存错误摘要，不存凭证与 PII
          error_detail: d.errorDetail ?? null,
          latency_ms: d.latencyMs,
        })),
      )
    } catch (e) {
      console.error('[notify] 投递记录落库失败（不影响已发出的通知）:', e)
    }
  }

  if (!wecom.success || !email.success) {
    console.error('[notify] 通知部分失败:', {
      wecom: wecom.success ? 'ok' : wecom.errorCode,
      email: email.success ? 'ok' : email.errorCode,
    })
  }

  return { email: email.success, wecom: wecom.success, deliveries }
}
