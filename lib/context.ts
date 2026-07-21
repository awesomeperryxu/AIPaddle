import 'server-only'
import { createClient } from '@/lib/supabase/server'

// 请求身份契约（ADR-002）：租户上下文只由服务端从可信会话推导，
// 绝不采信前端传入的 Header/参数。是 2.3 权限中间件（requirePermission）与
// 数据层 lib/data/*（每个函数首参 ctx）的统一输入。
export type Role = 'Admin' | 'Developer' | 'User' | 'Auditor'

export type RequestContext = {
  userId: string
  orgId: string
  roles: Role[]
}

/**
 * 从当前请求的会话解析租户上下文。未登录返回 null。
 * org_id 优先读 JWT app_metadata claim（Custom Access Token Hook，性能优化），
 * 缺失时回退查 users 表（seed/未启用 hook 阶段兼容，与 migration current_org_id() 一致）。
 * 所有查询走请求级客户端 → RLS 生效，天然只能读到自己那行/本租户数据。
 */
export async function getRequestContext(): Promise<RequestContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const claimOrg =
    typeof user.app_metadata?.org_id === 'string' ? (user.app_metadata.org_id as string) : undefined

  let orgId = claimOrg
  if (!orgId) {
    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()
    orgId = profile?.org_id ?? undefined
  }
  if (!orgId) return null

  // 租户停用强制（ADR-010）：所在租户 suspended → 拒绝访问（成员立即不可用）。
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('status')
    .eq('id', orgId)
    .maybeSingle()
  if ((tenantRow as { status?: string } | null)?.status === 'suspended') return null

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
  const roles = (roleRows ?? []).map((r) => r.role as Role)

  return { userId: user.id, orgId, roles }
}
