/**
 * L2 测试 · 多组织下的成员统计口径（ADR-025 配套）
 *
 * 🔴 用户实测发现：「北京品器」下面**没有成员数量**——明明 perry / zhangdd 都在里面当 Admin。
 * 原因是成员数一直按 users.org_id（主组织）算，而这两人的主组织在「平台管理团队」。
 *
 * 新口径：某组织的成员 = **归属**该组织的人。全平台则要给两个数——
 * 去重人数 + 其中跨组织的人数；只报去重数会让「各租户之和 ≠ 总数」看着像 bug。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = { users: [] as unknown[], user_orgs: [] as unknown[] }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (t: 'users' | 'user_orgs') => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is']) q[m] = vi.fn(() => q)
      q.then = (res: (v: { data: unknown[] }) => unknown) => res({ data: db[t] })
      return q
    },
  }),
}))

import { getOrgMemberStats, formatMemberTotal } from '@/lib/data/org-membership-stats'

const PLATFORM = 'org-platform'
const PINQI = 'org-pinqi'

beforeEach(() => {
  db.users = [{ id: 'perry' }, { id: 'zhangdd' }, { id: 'solo' }]
  db.user_orgs = [
    { user_id: 'perry', org_id: PLATFORM }, { user_id: 'perry', org_id: PINQI },
    { user_id: 'zhangdd', org_id: PLATFORM }, { user_id: 'zhangdd', org_id: PINQI },
    { user_id: 'solo', org_id: PLATFORM },
  ]
})

describe('按归属统计', () => {
  it('🔴 品器能统计出 2 名成员——这正是用户报的问题', async () => {
    const s = await getOrgMemberStats()
    expect(s.byOrg[PINQI]).toBe(2)
  })

  it('跨组织的人在每个归属组织都计入', async () => {
    const s = await getOrgMemberStats()
    expect(s.byOrg[PLATFORM]).toBe(3)
    expect(s.byOrg[PINQI]).toBe(2)
  })

  it('全平台按自然人去重，并给出重叠人数', async () => {
    const s = await getOrgMemberStats()
    expect(s.distinct).toBe(3)      // 三个自然人
    expect(s.overlapping).toBe(2)   // 其中两人跨组织
  })

  it('机器用户（Extension 服务账号）不计入', async () => {
    db.users = [{ id: 'perry' }] // 只有 perry 是真人
    const s = await getOrgMemberStats()
    expect(s.distinct).toBe(1)
    expect(s.byOrg[PLATFORM]).toBe(1)
  })
})

describe('展示文案', () => {
  it('有重叠 → 括号里说明', () => {
    expect(formatMemberTotal({ distinct: 12, overlapping: 2 })).toBe('12（含 2 人跨组织）')
  })

  it('无重叠 → 不加括号，别制造噪音', () => {
    expect(formatMemberTotal({ distinct: 12, overlapping: 0 })).toBe('12')
  })
})
