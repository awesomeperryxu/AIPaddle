/**
 * L2 单元测试 · BUG-86 成员「复活软删行」
 * 背景：users.id 是主键且引用 auth.users(id)，invite 对已注册邮箱会复用同一 auth uid，
 * 所以移除成员后再用同邮箱邀请/开通租户时走 INSERT 必撞 users_pkey。
 * 方案：发现同 email 的软删行 → UPDATE 复活（归属改到目标租户 + 解封 + 写审计），而非 INSERT。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { friendlyMemberInsertError } from '@/lib/data/members'
import { createFirstAdmin } from '@/lib/data/tenants'

// ── createFirstAdmin 的复活分支 ────────────────────────────────────────────────
type Opts = {
  softDeleted?: { id: string; org_id: string } | null
  userWriteError?: { message: string; code?: string } | null
  roleError?: { message: string } | null
}

function fakeAdmin(o: Opts = {}) {
  const calls: Record<string, unknown> = {}
  const ops: string[] = []
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() { return chain },
        eq(c: string, v: unknown) { (chain as { _eq?: Record<string, unknown> })._eq = { ...(chain as { _eq?: Record<string, unknown> })._eq, [c]: v }; return chain },
        not() { return chain },
        insert(row: unknown) {
          ops.push(`insert:${table}`)
          calls[`insert:${table}`] = row
          if (table === 'users') return { error: o.userWriteError ?? null }
          if (table === 'user_roles') return { error: o.roleError ?? null }
          return { error: null }
        },
        update(row: unknown) {
          ops.push(`update:${table}`)
          calls[`update:${table}`] = row
          const r: Record<string, unknown> = {
            eq() { return r },
            then(res: (v: unknown) => void) { return res({ error: table === 'users' ? (o.userWriteError ?? null) : null }) },
          }
          return r
        },
        delete() {
          ops.push(`delete:${table}`)
          const r: Record<string, unknown> = { eq() { return r }, then(res: (v: unknown) => void) { return res({ error: null }) } }
          return r
        },
        async maybeSingle() { return { data: o.softDeleted ?? null, error: null } },
      }
      return chain
    },
    auth: {
      admin: {
        async inviteUserByEmail(email: string) {
          calls.invite = email
          return { data: { user: { id: 'auth-uid-1', created_at: new Date().toISOString() } }, error: null }
        },
        async updateUserById(uid: string, attrs: Record<string, unknown>) {
          ops.push(`auth:${attrs.ban_duration}`)
          calls.lastBan = attrs.ban_duration
          return { error: null }
        },
        async deleteUser(uid: string) { ops.push('auth:delete'); calls.deletedAuthUser = uid; return { error: null } },
      },
    },
  }
  return { client, calls, ops }
}

const cast = (c: unknown) => c as Parameters<typeof createFirstAdmin>[0]
const run = (client: unknown) =>
  createFirstAdmin(cast(client), { orgId: 'org-new', name: '张三', email: 'a@b.com' })

describe('createFirstAdmin · 复活软删成员（BUG-86）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('无软删行 → 走 INSERT 新建', async () => {
    const { client, ops } = fakeAdmin({ softDeleted: null })
    await run(client)
    expect(ops).toContain('insert:users')
    expect(ops).not.toContain('update:users')
  })

  it('有软删行 → 走 UPDATE 复活，不再 INSERT（否则撞 users_pkey）', async () => {
    const { client, ops, calls } = fakeAdmin({ softDeleted: { id: 'old-uid', org_id: 'org-old' } })
    await run(client)
    expect(ops).toContain('update:users')
    expect(ops).not.toContain('insert:users')
    const patch = calls['update:users'] as Record<string, unknown>
    expect(patch.deleted_at).toBeNull()
    expect(patch.org_id).toBe('org-new')
    expect(patch.status).toBe('active')
  })

  it('复活后解除封禁（移除时封了 100 年，不解则设完密码也登不进来）', async () => {
    const { client, calls } = fakeAdmin({ softDeleted: { id: 'old-uid', org_id: 'org-old' } })
    await run(client)
    expect(calls.lastBan).toBe('none')
  })

  it('跨租户复活写 member.transferred 审计（service_role 绕过 RLS，审计是唯一溯源）', async () => {
    const { client, calls } = fakeAdmin({ softDeleted: { id: 'old-uid', org_id: 'org-old' } })
    await run(client)
    const log = calls['insert:audit_logs'] as Record<string, unknown>
    expect(log.action).toBe('member.transferred')
    expect((log.detail as Record<string, unknown>).from_org_id).toBe('org-old')
  })

  it('同租户内复活写 member.revived 审计', async () => {
    const { client, calls } = fakeAdmin({ softDeleted: { id: 'old-uid', org_id: 'org-new' } })
    await run(client)
    expect((calls['insert:audit_logs'] as Record<string, unknown>).action).toBe('member.revived')
  })

  it('🔴 复活路径失败 → 还原成软删态并放回原租户，绝不 DELETE 历史行', async () => {
    const { client, ops, calls } = fakeAdmin({
      softDeleted: { id: 'old-uid', org_id: 'org-old' },
      roleError: { message: 'role insert failed' },
    })
    await expect(run(client)).rejects.toThrow('role insert failed')

    expect(ops).not.toContain('delete:users') // 关键：不能真删别的租户的历史成员行
    const restore = calls['update:users'] as Record<string, unknown>
    expect(restore.org_id).toBe('org-old')     // 放回原租户
    expect(restore.deleted_at).toBeTruthy()    // 还原软删
    expect(calls.lastBan).toBe('876600h')      // 恢复封禁
  })

  it('新建路径失败 → 仍按原逻辑 DELETE 清理', async () => {
    const { client, ops } = fakeAdmin({ softDeleted: null, roleError: { message: 'x' } })
    await expect(run(client)).rejects.toThrow()
    expect(ops).toContain('delete:users')
  })
})

describe('friendlyMemberInsertError（BUG-86/87）', () => {
  it('users_pkey → 人话', () => {
    expect(friendlyMemberInsertError('duplicate key ... "users_pkey"', '23505'))
      .toBe('该邮箱在系统中已有账号，请联系平台管理员处理')
  })
  it('user_roles 唯一冲突（新旧索引名都识别）→ 人话', () => {
    expect(friendlyMemberInsertError('... "user_roles_user_id_role_key"', '23505')).toBe('该成员已拥有此角色')
    expect(friendlyMemberInsertError('... "uq_user_roles_active"', '23505')).toBe('该成员已拥有此角色')
  })
  it('非唯一约束错误原样透出', () => {
    expect(friendlyMemberInsertError('connection terminated', '08006')).toBe('connection terminated')
  })
})
