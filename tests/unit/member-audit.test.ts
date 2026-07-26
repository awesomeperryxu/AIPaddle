/**
 * L2 单元测试 · 4.8.4 成员授权审计
 * 验证：updateMemberRole → 写 member.role_updated；setMemberStatus → 写 member.status_changed。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

// 统一链式 supabase mock：所有链最终解析为 { data:{id}, error:null }，
// 满足 select().single()（查到成员）+ update/insert（error 为空）两类终点。
vi.mock('@/lib/supabase/server', () => {
  const result = { data: { id: 'target-user' }, error: null }
  const chain = () => {
    const p: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'update', 'insert']) p[m] = () => p
    p.single = async () => result
    p.maybeSingle = async () => result
    p.then = (resolve: (v: unknown) => void) => resolve(result) // 使 `await chain` 得 result
    return p
  }
  return { createClient: vi.fn().mockResolvedValue({ from: () => chain() }) }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
  }),
}))

import { updateMemberRole, setMemberStatus } from '@/lib/data/members'
import { writeAudit } from '@/lib/data/audit'

const ctx = { userId: 'admin-1', orgId: 'org1', roles: ['Admin'] } as never
const mockAudit = vi.mocked(writeAudit)

describe('成员授权审计（4.8.4）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updateMemberRole 写 member.role_updated', async () => {
    await updateMemberRole(ctx, 'target-user', 'Developer')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.role_updated', 'user', 'target-user', { role: 'Developer' })
  })

  it('setMemberStatus 写 member.status_changed', async () => {
    await setMemberStatus(ctx, 'target-user', 'inactive')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.status_changed', 'user', 'target-user', { status: 'inactive' })
  })
})
