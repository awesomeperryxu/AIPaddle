/**
 * L2 单元测试 · 4.8.3 开户闭环 · createFirstAdmin
 * 验证：Auth 邀请（带新租户 org_id）→ users 预建 → user_roles=Admin；任一步失败即抛错。
 */
import { describe, it, expect } from 'vitest'
import { createFirstAdmin } from '@/lib/data/tenants'

type Opts = { inviteError?: { message: string } | null; userError?: unknown; roleError?: unknown }
function fakeAdmin(o: Opts = {}) {
  const calls: Record<string, unknown> = {}
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          calls[table] = row
          if (table === 'users') return { error: o.userError ?? null }
          if (table === 'user_roles') return { error: o.roleError ?? null }
          return { error: null }
        },
      }
    },
    auth: {
      admin: {
        async inviteUserByEmail(email: string, opts: unknown) {
          calls.invite = { email, opts }
          return o.inviteError
            ? { data: null, error: o.inviteError }
            : { data: { user: { id: 'auth-uid-1' } }, error: null }
        },
      },
    },
  }
  return { client, calls }
}

const cast = (c: unknown) => c as Parameters<typeof createFirstAdmin>[0]

describe('createFirstAdmin（4.8.3 开户闭环）', () => {
  it('成功：邀请带新租户 org_id + 建 users + 授 Admin，返回 uid', async () => {
    const { client, calls } = fakeAdmin()
    const uid = await createFirstAdmin(cast(client), { orgId: 'org-new', name: '张三', email: 'a@b.com' })
    expect(uid).toBe('auth-uid-1')
    expect(calls.invite).toEqual({ email: 'a@b.com', opts: { data: { org_id: 'org-new', name: '张三' } } })
    expect(calls.users).toMatchObject({ id: 'auth-uid-1', org_id: 'org-new', email: 'a@b.com', status: 'active' })
    expect(calls.user_roles).toEqual({ user_id: 'auth-uid-1', org_id: 'org-new', role: 'Admin' })
  })

  it('邀请失败 → 抛错，不建 users/role', async () => {
    const { client, calls } = fakeAdmin({ inviteError: { message: '邮箱已被使用' } })
    await expect(createFirstAdmin(cast(client), { orgId: 'o', name: 'n', email: 'x@y.com' })).rejects.toThrow('邮箱已被使用')
    expect(calls.users).toBeUndefined()
    expect(calls.user_roles).toBeUndefined()
  })

  it('users 建号失败 → 抛错', async () => {
    const { client } = fakeAdmin({ userError: { message: 'users insert failed' } })
    await expect(createFirstAdmin(cast(client), { orgId: 'o', name: 'n', email: 'x@y.com' })).rejects.toThrow('users insert failed')
  })

  it('授角色失败 → 抛错', async () => {
    const { client } = fakeAdmin({ roleError: { message: 'role insert failed' } })
    await expect(createFirstAdmin(cast(client), { orgId: 'o', name: 'n', email: 'x@y.com' })).rejects.toThrow('role insert failed')
  })
})
