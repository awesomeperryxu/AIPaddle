/**
 * L2 复现测试 · BUG-90 / BUG-91（2026-08-03 用户实测报告）
 *
 * BUG-90：租户管理页改了「管理员邮箱」，成员管理页查无此人、租户方也登不进来。
 *   根因：contact_email 只是 tenants 表的一个字段，与 users 表毫无关联。
 *
 * BUG-91：成员数显示 2，但页面上只找得到 1 个人。
 *   根因：计数把 Extension 的机器用户也算进去了 —— ADR-020 §3 写明机器用户
 *   不占席位、不进成员列表，但当时只写在迁移注释里，应用层从没落实。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  from: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: h.from,
    auth: { admin: { createUser: h.createUser, updateUserById: h.updateUserById } },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: h.from }) }))
// 只替换 tenants.ts 依赖的那一个导出，listMembers 必须保留真实实现——
// 整模块 mock 会把被测函数本身也换掉，测了个寂寞
vi.mock('@/lib/data/members', async (orig) => ({
  ...(await orig<typeof import('@/lib/data/members')>()),
  findAuthUserByEmail: vi.fn(),
}))

beforeEach(() => { Object.values(h).forEach(f => f.mockReset()) })

describe('BUG-91 · 成员计数必须排除机器用户', () => {
  it('users 表 2 行（1 真人 + 1 机器）时，成员数应为 1', async () => {
    // 复现关键：断言查询链上确实调用了 .eq('is_service_account', false)
    const calls: Array<[string, unknown]> = []
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.eq = (col: string, val: unknown) => { calls.push([col, val]); return chain }
    chain.is = () => chain
    chain.order = () => Promise.resolve({ data: [], error: null })
    chain.then = undefined
    h.from.mockReturnValue(chain)

    const { listMembers } = await import('@/lib/data/members')
    await listMembers({ userId: 'u1', orgId: 'org-1', roles: ['Admin'] })

    expect(calls).toContainEqual(['is_service_account', false])
  })
})

describe('BUG-90 · 改管理员邮箱要同步账号', () => {
  /** 构造 admin.from(...) 的链式桩：users 查询返回 rows，tenants 更新返回成功 */
  function mockTables(opts: { existingByEmail?: unknown; orgAdmins?: unknown[] }) {
    h.from.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          update: () => ({
            eq: () => ({ is: () => ({ select: () => Promise.resolve({ data: [{ id: 't1' }], error: null }) }) }),
          }),
        }
      }
      // users
      return {
        select: (cols: string) => ({
          eq: (c: string) => {
            if (c === 'email') return { maybeSingle: () => Promise.resolve({ data: opts.existingByEmail ?? null }) }
            // 查本租户在册管理员
            return {
              is: () => ({ eq: () => Promise.resolve({ data: opts.orgAdmins ?? [], error: null }) }),
            }
          },
          _cols: cols,
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    })
  }

  it('租户已有管理员 → 改其邮箱，而不是再开一个账号', async () => {
    mockTables({ orgAdmins: [{ id: 'admin-1', email: 'old@x.com', user_roles: [{ role: 'Admin' }] }] })
    h.updateUserById.mockResolvedValue({ error: null })

    const { updateTenantByPlatform } = await import('@/lib/data/tenants')
    await updateTenantByPlatform('t1', { contactEmail: 'new@royalblack.com' })

    expect(h.updateUserById).toHaveBeenCalledWith('admin-1', { email: 'new@royalblack.com', email_confirm: true })
    expect(h.createUser).not.toHaveBeenCalled()  // 不能越改越多
  })

  it('邮箱已属于其他租户 → 抛错而不是静默跳过', async () => {
    mockTables({ existingByEmail: { id: 'u9', org_id: 'OTHER-ORG', deleted_at: null } })

    const { updateTenantByPlatform } = await import('@/lib/data/tenants')
    await expect(updateTenantByPlatform('t1', { contactEmail: 'taken@x.com' })).rejects.toThrow(/已被其他企业占用/)
  })

  it('邮箱就是本租户现有成员 → 不重复操作', async () => {
    mockTables({ existingByEmail: { id: 'u1', org_id: 't1', deleted_at: null } })

    const { updateTenantByPlatform } = await import('@/lib/data/tenants')
    await updateTenantByPlatform('t1', { contactEmail: 'exists@x.com' })

    expect(h.updateUserById).not.toHaveBeenCalled()
    expect(h.createUser).not.toHaveBeenCalled()
  })
})
