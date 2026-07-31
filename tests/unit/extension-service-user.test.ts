/**
 * L2 测试 · V12-8.4 修正：Extension 机器用户生命周期（ADR-020 §3）
 *
 * 这条链路是 8a 的命门——机器用户缺失时 Extension 看起来建成了、也能发布，
 * 但外部一调就是 503。故三处都要有断言：建时创建、失败回滚、发布前拦截。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  adminFrom: vi.fn(),
  reqFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: h.createUser, deleteUser: h.deleteUser } },
    from: h.adminFrom,
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: h.reqFrom }) }))

import { createExtension, transitionExtension } from '@/lib/data/extensions'

const ctx = { userId: 'u-1', orgId: 'org-1', roles: ['Admin' as const] }
const input = {
  name: '黑围裙官网咨询',
  targetType: 'agent' as const,
  targetId: '11111111-1111-4111-8111-111111111111',
  allowedOrigins: ['https://www.royalblack-hotel.com'],
}
const SVC_ID = 'svc-user-1'

beforeEach(() => {
  Object.values(h).forEach(f => f.mockReset())
  h.createUser.mockResolvedValue({ data: { user: { id: SVC_ID } }, error: null })
  h.deleteUser.mockResolvedValue({ error: null })
})

/** admin.from('users') 的链式 mock */
function mockAdminUsers(insertResult: { error: unknown }) {
  const del = { eq: vi.fn().mockResolvedValue({ error: null }) }
  h.adminFrom.mockReturnValue({
    insert: vi.fn().mockResolvedValue(insertResult),
    delete: vi.fn().mockReturnValue(del),
  })
  return del
}

describe('createExtension 必须创建机器用户', () => {
  it('建 Extension 时创建 auth 用户 + users 档案，并把 service_user_id 写入', async () => {
    mockAdminUsers({ error: null })
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'ext-1', name: input.name, description: null, kind: 'api',
            target_type: 'agent', target_id: input.targetId, target_version: null,
            allowed_origins: input.allowedOrigins, rate_limit_per_min: 60,
            status: 'draft', service_user_id: SVC_ID, created_at: '2026-07-31',
          },
          error: null,
        }),
      }),
    })
    h.reqFrom.mockReturnValue({ insert })

    const ext = await createExtension(ctx, input)

    expect(h.createUser).toHaveBeenCalledOnce()
    // 机器用户必须落在同一租户且带 is_service_account 标记
    const profile = h.adminFrom.mock.results[0].value.insert.mock.calls[0][0]
    expect(profile).toMatchObject({ id: SVC_ID, org_id: 'org-1', is_service_account: true })
    // 机器用户邮箱不可投递，避免与真人账号混淆
    expect(profile.email).toMatch(/@service\.aipaddle\.local$/)
    // Extension 行必须带上 service_user_id
    expect(insert.mock.calls[0][0]).toMatchObject({ service_user_id: SVC_ID, status: 'draft' })
    // 对外只暴露有无，不泄露 id
    expect(ext.hasServiceUser).toBe(true)
    expect(JSON.stringify(ext)).not.toContain(SVC_ID)
  })

  it('users 档案写入失败 → 回滚 auth 用户，不留孤儿账号', async () => {
    mockAdminUsers({ error: { message: 'duplicate' } })
    h.reqFrom.mockReturnValue({ insert: vi.fn() })

    await expect(createExtension(ctx, input)).rejects.toThrow(/机器用户档案/)
    expect(h.deleteUser).toHaveBeenCalledWith(SVC_ID)
  })

  it('extensions 插入失败 → 同样回滚机器用户', async () => {
    mockAdminUsers({ error: null })
    h.reqFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'boom' } }) }) }),
    })

    await expect(createExtension(ctx, input)).rejects.toThrow()
    expect(h.deleteUser).toHaveBeenCalledWith(SVC_ID)
  })
})

describe('发布前拦截缺身份的 Extension', () => {
  const EXT_ID = '11111111-1111-4111-8111-111111111111'

  function mockServiceUser(serviceUserId: string | null) {
    h.reqFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: { service_user_id: serviceUserId } }) }) }) }),
      }),
      // 若守卫失效放行到这一步，update 返回 0 行，测试会因 reason 不符而失败（而非误判通过）
      update: () => ({
        eq: () => ({ eq: () => ({ is: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
      }),
    })
  }

  // 两个动作都通往 published，缺一个就是漏网之鱼
  it.each(['approve', 'online'] as const)(
    'service_user_id 为空时 %s 被拒（否则上线即 503）',
    async (action) => {
      mockServiceUser(null)
      const r = await transitionExtension(ctx, EXT_ID, action)
      expect(r).toEqual({ ok: false, reason: 'no_service_user' })
    },
  )

  it('不通往 published 的动作不受此守卫影响（submit 仍按状态机判定）', async () => {
    mockServiceUser(null)
    const r = await transitionExtension(ctx, EXT_ID, 'submit')
    expect(r).not.toEqual({ ok: false, reason: 'no_service_user' })
  })
})
