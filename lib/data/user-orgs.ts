import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 多组织归属与切换（ADR-025）。
//
// 归属集合（user_orgs）= 这个人**可以**进哪些组织；
// 活跃组织（users.active_org_id）= 此刻**以哪个组织身份**在操作，决定 RLS 放行哪一家的数据。

export type MyOrg = {
  id: string
  name: string
  status: string
  /** 是否当前活跃 */
  active: boolean
  /** 是否主组织（账号出身，停用自愈时的回落目标） */
  home: boolean
  /** 在该组织里的角色 */
  roles: string[]
}

type OrgRow = { org_id: string; tenants: { name: string; status: string } | null }

/** 列出我能进的所有组织（组织切换器的数据源） */
export async function listMyOrgs(ctx: RequestContext): Promise<MyOrg[]> {
  const supabase = await createClient()
  const [{ data: orgRows }, { data: me }, { data: roleRows }] = await Promise.all([
    supabase.from('user_orgs').select('org_id,tenants(name,status)').eq('user_id', ctx.userId),
    supabase.from('users').select('org_id').eq('id', ctx.userId).maybeSingle(),
    supabase.from('user_roles').select('org_id,role').eq('user_id', ctx.userId).is('deleted_at', null),
  ])

  const home = (me as { org_id?: string } | null)?.org_id
  const rolesByOrg = new Map<string, string[]>()
  for (const r of (roleRows ?? []) as { org_id: string; role: string }[]) {
    rolesByOrg.set(r.org_id, [...(rolesByOrg.get(r.org_id) ?? []), r.role])
  }

  return ((orgRows ?? []) as unknown as OrgRow[])
    .map((r) => ({
      id: r.org_id,
      name: r.tenants?.name ?? '(未知组织)',
      status: r.tenants?.status ?? 'unknown',
      active: r.org_id === ctx.orgId,
      home: r.org_id === home,
      roles: rolesByOrg.get(r.org_id) ?? [],
    }))
    // 主组织排最前，其余按名称，便于稳定定位
    .sort((a, b) => Number(b.home) - Number(a.home) || a.name.localeCompare(b.name, 'zh'))
}

export type SwitchResult =
  | { ok: true; orgId: string; name: string }
  | { ok: false; reason: 'not_member' | 'suspended' | 'failed'; message: string }

/**
 * 切换活跃组织。
 *
 * 🔴 三重校验，缺一不可（ADR-025 §2.1）：这里是应用层这一道，
 * 数据库触发器 assert_active_org_membership 是绕不过去的最后一道。
 * active_org_id 直接决定 RLS 放行哪一家的数据，能自行乱改 = 一键越权到任意租户。
 */
export async function switchActiveOrg(ctx: RequestContext, targetOrgId: string): Promise<SwitchResult> {
  const supabase = await createClient()

  // ① 必须是自己归属的组织。RLS 只让读到自己那几行，查不到即非成员
  const { data: membership } = await supabase
    .from('user_orgs')
    .select('org_id,tenants(name,status)')
    .eq('user_id', ctx.userId)
    .eq('org_id', targetOrgId)
    .maybeSingle()
  if (!membership) {
    return { ok: false, reason: 'not_member', message: '你不属于该组织' }
  }

  // ② 🔴 停用的组织不许切入：切进去之后 getRequestContext 会判定不可用，
  //    虽然有回落主组织的自愈，但让用户切到一个用不了的组织本身就是错的（ADR-025 §2.4）
  const t = (membership as unknown as OrgRow).tenants
  if (t?.status === 'suspended') {
    return { ok: false, reason: 'suspended', message: `「${t.name}」已停用，无法切入` }
  }

  const { error } = await supabase
    .from('users')
    .update({ active_org_id: targetOrgId, updated_at: new Date().toISOString() })
    .eq('id', ctx.userId)
  if (error) return { ok: false, reason: 'failed', message: error.message }

  return { ok: true, orgId: targetOrgId, name: t?.name ?? '' }
}
