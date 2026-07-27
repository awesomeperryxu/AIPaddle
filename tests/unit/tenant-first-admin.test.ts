/**
 * L2 单元测试 · 4.8.3 开户闭环 · createFirstAdmin
 * 验证：Auth 邀请（带新租户 org_id）→ users 预建 → user_roles=Admin；任一步失败即抛错。
 * BUG-81 追加：失败时补偿清理（删本租户 users/user_roles；auth 账号仅当本次新建才删）+ 唯一约束报错转人话。
 */
import { describe, it, expect } from 'vitest'
import { createFirstAdmin } from '@/lib/data/tenants'

type Opts = {
  inviteError?: { message: string } | null
  userError?: { message: string; code?: string } | null
  roleError?: { message: string } | null
  /** 模拟 invite 复用了「已注册但未确认」的旧账号（BUG-81 现场） */
  reuseExistingAuthUser?: boolean
}

function fakeAdmin(o: Opts = {}) {
  const calls: Record<string, unknown> = {}
  const deletes: { table: string; filters: Record<string, unknown> }[] = []
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          calls[table] = row
          if (table === 'users') return { error: o.userError ?? null }
          if (table === 'user_roles') return { error: o.roleError ?? null }
          return { error: null }
        },
        delete() {
          const rec = { table, filters: {} as Record<string, unknown> }
          deletes.push(rec)
          const chain: Record<string, unknown> = {
            eq(col: string, val: unknown) { rec.filters[col] = val; return chain },
            then(resolve: (v: unknown) => void) { return resolve({ error: null }) },
          }
          return chain
        },
      }
    },
    auth: {
      admin: {
        async inviteUserByEmail(email: string, opts: unknown) {
          calls.invite = { email, opts }
          if (o.inviteError) return { data: null, error: o.inviteError }
          const createdAt = o.reuseExistingAuthUser
            ? new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 小时前注册的旧账号
            : new Date().toISOString()
          return { data: { user: { id: 'auth-uid-1', created_at: createdAt } }, error: null }
        },
        async deleteUser(uid: string) {
          calls.deletedAuthUser = uid
          return { error: null }
        },
      },
    },
  }
  return { client, calls, deletes }
}

const cast = (c: unknown) => c as Parameters<typeof createFirstAdmin>[0]
const run = (client: unknown, over: Partial<{ orgId: string; name: string; email: string }> = {}) =>
  createFirstAdmin(cast(client), { orgId: 'org-new', name: '张三', email: 'a@b.com', ...over })

describe('createFirstAdmin（4.8.3 开户闭环）', () => {
  it('成功：邀请带新租户 org_id + 建 users + 授 Admin，返回 uid', async () => {
    const { client, calls, deletes } = fakeAdmin()
    const uid = await run(client)
    expect(uid).toBe('auth-uid-1')
    expect(calls.invite).toEqual({ email: 'a@b.com', opts: { data: { org_id: 'org-new', name: '张三' } } })
    expect(calls.users).toMatchObject({ id: 'auth-uid-1', org_id: 'org-new', email: 'a@b.com', status: 'active' })
    expect(calls.user_roles).toEqual({ user_id: 'auth-uid-1', org_id: 'org-new', role: 'Admin' })
    expect(deletes).toHaveLength(0) // 成功路径不触发任何清理
  })

  it('邀请失败 → 抛错，不建 users/role', async () => {
    const { client, calls } = fakeAdmin({ inviteError: { message: '邮箱已被使用' } })
    await expect(run(client)).rejects.toThrow('邮箱已被使用')
    expect(calls.users).toBeUndefined()
    expect(calls.user_roles).toBeUndefined()
  })

  it('users 建号失败 → 抛错', async () => {
    const { client } = fakeAdmin({ userError: { message: 'users insert failed' } })
    await expect(run(client)).rejects.toThrow('users insert failed')
  })

  it('授角色失败 → 抛错', async () => {
    const { client } = fakeAdmin({ roleError: { message: 'role insert failed' } })
    await expect(run(client)).rejects.toThrow('role insert failed')
  })
})

describe('createFirstAdmin 失败补偿（BUG-81）', () => {
  it('users_pkey 冲突 → 报人话而非 Postgres 原文', async () => {
    const { client } = fakeAdmin({
      userError: { message: 'duplicate key value violates unique constraint "users_pkey"', code: '23505' },
    })
    await expect(run(client)).rejects.toThrow('该邮箱在系统中已有账号且归属其他企业，请更换联系邮箱')
  })

  it('email 唯一约束冲突 → 报人话', async () => {
    const { client } = fakeAdmin({
      userError: { message: 'duplicate key value violates unique constraint "users_email_key"', code: '23505' },
    })
    await expect(run(client)).rejects.toThrow('该邮箱已被占用，请更换联系邮箱')
  })

  it('授角色失败（本次新建的 auth 账号）→ 清 user_roles/users 并删 auth 账号', async () => {
    const { client, calls, deletes } = fakeAdmin({ roleError: { message: 'role insert failed' } })
    await expect(run(client)).rejects.toThrow('role insert failed')

    expect(deletes.map((d) => d.table)).toEqual(['user_roles', 'users'])
    expect(deletes[0].filters).toEqual({ user_id: 'auth-uid-1', org_id: 'org-new' })
    expect(deletes[1].filters).toEqual({ id: 'auth-uid-1', org_id: 'org-new' })
    expect(calls.deletedAuthUser).toBe('auth-uid-1')
  })

  it('复用已存在的旧 auth 账号时失败 → 绝不删该账号（否则误删他人账号）', async () => {
    const { client, calls, deletes } = fakeAdmin({
      reuseExistingAuthUser: true,
      userError: { message: 'duplicate key value violates unique constraint "users_pkey"', code: '23505' },
    })
    await expect(run(client)).rejects.toThrow('请更换联系邮箱')

    expect(deletes.map((d) => d.table)).toEqual(['user_roles', 'users'])
    expect(calls.deletedAuthUser).toBeUndefined() // 关键断言
  })

  it('清理只针对本租户，不误删同 uid 在他租户的行', async () => {
    const { client, deletes } = fakeAdmin({ roleError: { message: 'x' } })
    await expect(run(client, { orgId: 'org-mine' })).rejects.toThrow()
    for (const d of deletes) expect(d.filters.org_id).toBe('org-mine')
  })
})
