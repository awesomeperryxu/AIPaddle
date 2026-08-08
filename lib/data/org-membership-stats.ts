import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// 多组织下的成员统计口径（ADR-025 配套）。
//
// 🔴 问题：成员数一直按 `users.org_id`（主组织）算。多组织归属之后，
// perry / zhangdd 归属了「北京品器」但主组织在「平台管理团队」，
// 于是品器显示 **0 成员**——明明有两个 Admin 在里面。
//
// 新口径：**某组织的成员 = 归属该组织的人**（user_orgs），主组织只是其中一种归属
// （迁移 0039 已为每个用户回填一条 `(id, org_id)`，所以老数据口径不变）。
//
// 全平台总数则要区分两个数：
//   · 去重人数：真实有多少个自然人（一个人归属三家只算一个）
//   · 重叠人数：其中有多少人归属了不止一个组织
// 只报去重数会让「各租户成员数之和 ≠ 总数」显得像 bug，两个数一起给才说得清。

export type OrgMemberStats = {
  /** 各组织的成员数（含多组织归属者） */
  byOrg: Record<string, number>
  /** 去重后的自然人总数 */
  distinct: number
  /** 其中归属多个组织的人数 */
  overlapping: number
}

type Row = { user_id: string; org_id: string }

/**
 * 全平台成员统计（跨租户，供平台看板/租户列表用）。
 * ⚠️ 用 admin 客户端跨租户读，调用方必须已过 isPlatformAdmin。
 */
export async function getOrgMemberStats(): Promise<OrgMemberStats> {
  const admin = createAdminClient()

  // 机器用户（Extension 服务账号）不算成员——与成员详情列表口径保持一致
  const [{ data: humans }, { data: memberships }] = await Promise.all([
    admin.from('users').select('id').eq('is_service_account', false).is('deleted_at', null),
    admin.from('user_orgs').select('user_id,org_id'),
  ])

  const humanIds = new Set(((humans as { id: string }[] | null) ?? []).map((u) => u.id))
  const orgsByUser = new Map<string, Set<string>>()
  const byOrg: Record<string, number> = {}

  for (const m of ((memberships as Row[] | null) ?? [])) {
    if (!humanIds.has(m.user_id)) continue
    byOrg[m.org_id] = (byOrg[m.org_id] ?? 0) + 1
    if (!orgsByUser.has(m.user_id)) orgsByUser.set(m.user_id, new Set())
    orgsByUser.get(m.user_id)!.add(m.org_id)
  }

  let overlapping = 0
  for (const orgs of orgsByUser.values()) if (orgs.size > 1) overlapping++

  return { byOrg, distinct: orgsByUser.size, overlapping }
}

/** 「12（含 2 人跨组织）」——重叠为 0 时不显示括号，别给用户增加噪音 */
export function formatMemberTotal(s: Pick<OrgMemberStats, 'distinct' | 'overlapping'>): string {
  return s.overlapping > 0 ? `${s.distinct}（含 ${s.overlapping} 人跨组织）` : String(s.distinct)
}
