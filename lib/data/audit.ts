import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 审计留痕（4.1.3）。audit_logs 不可篡改（无 deleted_at/updated_at），只追加。
// 写失败不应阻断主流程（业务已落库），因此吞掉错误只记 console。
export async function writeAudit(
  ctx: RequestContext,
  action: string, // 如 agent.submit / agent.approve / agent.reject
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('audit_logs').insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action,
      target_type: targetType,
      target_id: targetId,
      detail,
    })
    if (error) console.error('[audit] 写入失败:', action, error.message)
  } catch (e) {
    console.error('[audit] 写入异常:', action, e)
  }
}
