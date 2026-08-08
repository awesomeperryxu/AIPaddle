import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

/**
 * 平台超管判定（ADR-010 + ADR-025）：在 allowlist 里 **且** 当前活跃组织是平台运营租户。
 *
 * 🔴 为什么要看活跃组织：多组织归属后，同一个人既是平台超管、又是某客户租户的 Admin。
 * 只查 allowlist 的话，他切到客户组织后**仍然带着跨租户权限**——
 * 侧边栏照样显示「租户管理」、照样能停用别家租户。四个后果：
 * 权限过大（以客户身份操作却握着平台权）、审计分不清当时是哪种身份、
 * 界面错乱（客户视角下看到全平台管理）、以及在客户上下文里误操作别家租户。
 *
 * 所以：停在平台运营租户 = 平台超管；切到客户租户 = 纯租户 Admin。
 * 这是最小权限原则的直接体现，也让审计能如实反映「他当时以什么身份做的」。
 */
export async function isPlatformAdmin(ctx: RequestContext): Promise<boolean> {
  const supabase = await createClient()
  const [{ data: allow }, { data: tenant }] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('tenants').select('is_platform').eq('id', ctx.orgId).maybeSingle(),
  ])
  if (!allow) return false
  return (tenant as { is_platform?: boolean } | null)?.is_platform === true
}
