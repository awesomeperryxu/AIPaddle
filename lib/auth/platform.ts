import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

/**
 * 平台超管判定（ADR-010）：查 platform_admins allowlist（RLS 自读）。
 * 与 org 角色矩阵(ADR-007)正交——用于跨租户的平台租户开通/停用/列表授权。
 */
export async function isPlatformAdmin(ctx: RequestContext): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', ctx.userId)
    .maybeSingle()
  return !!data
}
