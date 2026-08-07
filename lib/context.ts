import 'server-only'
import { createClient } from '@/lib/supabase/server'

// 请求身份契约（ADR-002）：租户上下文只由服务端从可信会话推导，
// 绝不采信前端传入的 Header/参数。是 2.3 权限中间件（requirePermission）与
// 数据层 lib/data/*（每个函数首参 ctx）的统一输入。
export type Role = 'Admin' | 'Developer' | 'User' | 'Auditor'

export type RequestContext = {
  userId: string
  /** 当前活跃组织。多组织归属下等于 users.active_org_id（ADR-025） */
  orgId: string
  /** 角色是「在当前活跃组织里的角色」——同一个人在不同组织可以是不同角色 */
  roles: Role[]
}

/**
 * 从当前请求的会话解析租户上下文。未登录返回 null。
 *
 * 🔴 ADR-025 起 orgId 一律以 `users.active_org_id` 为准，**不再优先读 JWT claim**。
 * claim 里的 org_id 是登录那一刻写死的，切换组织后不会变；继续信它会出现
 * 「界面已切到 B 组织、后端仍按 A 组织放行」——读到的是另一家的数据，而且不报错。
 * 代价是每请求多一次 users 查询，但本函数本来就要查 user_roles 和 tenants，可忽略。
 *
 * 所有查询走请求级客户端 → RLS 生效，天然只能读到自己那行/本租户数据。
 */
export async function getRequestContext(): Promise<RequestContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('org_id,active_org_id')
    .eq('id', user.id)
    .maybeSingle()

  const home = (profile as { org_id?: string } | null)?.org_id
  const active = (profile as { active_org_id?: string | null } | null)?.active_org_id
  // claim 只作为查库失败时的降级（seed / 迁移过渡期），正常路径不用它
  const claimOrg =
    typeof user.app_metadata?.org_id === 'string' ? (user.app_metadata.org_id as string) : undefined
  let orgId = active ?? home ?? claimOrg
  if (!orgId) return null

  // 租户停用强制（ADR-010）：suspended 租户的成员立即不可用。
  // 🔴 ADR-025 §2.4：活跃组织被停用时**回落到主组织**而不是直接拒绝——
  // 否则「切到某客户 → 该客户被停用」会把人永久关在门外，
  // 连切回自己主组织的入口都没有（返回 null 等于整个应用视为未登录）。
  const statusOf = async (id: string): Promise<string | undefined> => {
    const { data } = await supabase.from('tenants').select('status').eq('id', id).maybeSingle()
    return (data as { status?: string } | null)?.status
  }
  if (await statusOf(orgId) === 'suspended') {
    if (!home || home === orgId || (await statusOf(home)) === 'suspended') return null
    orgId = home
  }

  // 角色按活跃组织取：一个人在 A 组织是 User、在 B 组织是 Admin，
  // 不按 org 过滤就会把 B 的 Admin 带到 A 去用（ADR-025 §2.2）
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
  const roles = (roleRows ?? []).map((r) => r.role as Role)

  return { userId: user.id, orgId, roles }
}
