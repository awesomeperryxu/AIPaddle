/**
 * L2 单元测试 · BUG-81 联系邮箱占用前置校验（assertEmailAvailable）
 * 背景：一个邮箱只能属于一个租户（public.users.id 主键引用 auth.users + email 全局唯一）。
 * 该校验必须在建租户「之前」拦下，避免「建完再撞库回滚」并把 Postgres 原文甩给用户。
 */
import { describe, it, expect } from 'vitest'
import { assertEmailAvailable } from '@/lib/data/tenants'

type Occupied = { id: string; org_id: string; deleted_at: string | null } | null

function fakeAdmin(occupied: Occupied, orgName: string | null = 'AIPaddle Demo') {
  const queried: Record<string, unknown> = {}
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() { return chain },
        eq(col: string, val: unknown) { queried[`${table}.${col}`] = val; return chain },
        async maybeSingle() {
          if (table === 'users') return { data: occupied, error: null }
          if (table === 'tenants') return { data: orgName === null ? null : { name: orgName }, error: null }
          return { data: null, error: null }
        },
      }
      return chain
    },
  }
  return { client, queried }
}

const cast = (c: unknown) => c as Parameters<typeof assertEmailAvailable>[0]

describe('assertEmailAvailable（BUG-81）', () => {
  it('邮箱未被占用 → 放行', async () => {
    const { client, queried } = fakeAdmin(null)
    await expect(assertEmailAvailable(cast(client), 'free@aipaddle-test.local')).resolves.toBeUndefined()
    expect(queried['users.email']).toBe('free@aipaddle-test.local')
  })

  it('邮箱已是其他租户的在册成员 → 报出占用方企业名', async () => {
    const { client } = fakeAdmin({ id: 'u1', org_id: 'org-demo', deleted_at: null }, '北京市品器管理咨询有限公司')
    await expect(assertEmailAvailable(cast(client), 'zhangdd@aipaddle.net'))
      .rejects.toThrow('该邮箱已是「北京市品器管理咨询有限公司」的成员，请更换联系邮箱')
  })

  // 契约变更（BUG-86，2026-07-27）：软删成员**不再算永久占用**。
  // 旧行为是拒绝并提示「仍占用唯一约束」——那让「移除成员后用同邮箱开新租户」成为死路。
  // 新行为放行，由 createFirstAdmin 复活那一行（UPDATE 而非 INSERT，避开 users_pkey）。
  it('邮箱属于已被移除（软删）的成员 → 放行，交由 createFirstAdmin 复活', async () => {
    const { client } = fakeAdmin({ id: 'u1', org_id: 'org-demo', deleted_at: '2026-07-20T00:00:00Z' })
    await expect(assertEmailAvailable(cast(client), 'gone@aipaddle-test.local')).resolves.toBeUndefined()
  })

  it('在册成员仍然拒绝（一个邮箱同时只能属于一个租户）', async () => {
    const { client } = fakeAdmin({ id: 'u1', org_id: 'org-demo', deleted_at: null }, '某企业')
    await expect(assertEmailAvailable(cast(client), 'active@aipaddle-test.local'))
      .rejects.toThrow('该邮箱已是「某企业」的成员，请更换联系邮箱')
  })

  it('查不到占用方企业名 → 降级为「其他企业」，不泄露 org_id', async () => {
    const { client } = fakeAdmin({ id: 'u1', org_id: 'org-x', deleted_at: null }, null)
    await expect(assertEmailAvailable(cast(client), 'x@aipaddle-test.local'))
      .rejects.toThrow('该邮箱已是「其他企业」的成员，请更换联系邮箱')
  })
})
