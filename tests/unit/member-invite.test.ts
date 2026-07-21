import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.5.1 / S5-01：inviteMember 幂等——同租户内邮箱已存在则拒绝并返回中文提示。

const { dupMaybeSingle, inviteByEmail } = vi.hoisted(() => ({
  dupMaybeSingle: vi.fn(),
  inviteByEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      // 幂等预检：select().eq().is().maybeSingle()
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({ maybeSingle: dupMaybeSingle }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { inviteUserByEmail: inviteByEmail } },
  }),
}))

import { inviteMember } from '@/lib/data/members'

const ctx = { userId: 'u1', orgId: 'org1', roles: ['Admin'] } as never

describe('inviteMember 幂等（S5-01）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('邮箱已存在 → 抛「已邀请或已是成员」，不发 Auth 邀请', async () => {
    dupMaybeSingle.mockResolvedValue({ data: { id: 'existing' }, error: null })
    await expect(
      inviteMember(ctx, { email: 'dup@aipaddle-test.local', name: '吴新人', role: 'Developer' }),
    ).rejects.toThrow(/已邀请|已是成员/)
    expect(inviteByEmail).not.toHaveBeenCalled()
  })
})
