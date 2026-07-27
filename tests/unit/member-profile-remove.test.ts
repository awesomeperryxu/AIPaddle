/**
 * L2 单元测试 · 4.8.12 成员资料编辑与移除
 * 覆盖：updateMemberProfile 落库+审计 / removeMember 两条护栏（移除自己、最后一名管理员）+ 审计。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

// 可变 mock 状态：控制 user_roles 查询返回的活跃 Admin 集合
const state = vi.hoisted(() => ({ adminIds: ['admin-1', 'target-user'] }))

// 链式 supabase mock：读 user_roles 时返回 Admin 行；写操作（update/insert）返回无错误；
// select().single() 返回命中成员（同租户）。
vi.mock('@/lib/supabase/server', () => {
  const chain = (table: string) => {
    const p: Record<string, unknown> = {}
    let isWrite = false
    for (const m of ['select', 'eq', 'is', 'order']) p[m] = () => p
    p.update = () => { isWrite = true; return p }
    p.insert = () => { isWrite = true; return p }
    p.single = async () => ({ data: { id: 'target-user' }, error: null })
    p.maybeSingle = async () => ({ data: { id: 'target-user' }, error: null })
    p.then = (resolve: (v: unknown) => void) => {
      if (!isWrite && table === 'user_roles') {
        return resolve({ data: state.adminIds.map((id) => ({ user_id: id })), error: null })
      }
      return resolve({ data: null, error: null })
    }
    return p
  }
  return { createClient: vi.fn().mockResolvedValue({ from: (t: string) => chain(t) }) }
})

const banSpy = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { updateUserById: (...a: unknown[]) => banSpy(...a) } },
  }),
}))

import { updateMemberProfile, removeMember } from '@/lib/data/members'
import { writeAudit } from '@/lib/data/audit'

const ctx = { userId: 'admin-1', orgId: 'org1', roles: ['Admin'] } as never
const mockAudit = vi.mocked(writeAudit)

describe('updateMemberProfile（4.8.12）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('改姓名+部门 → 写 member.profile_updated 审计', async () => {
    await updateMemberProfile(ctx, 'target-user', { name: '张三', department: '技术部' })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.profile_updated', 'user', 'target-user', {
      name: '张三', department: '技术部',
    })
  })

  it('部门传空字符串 → 审计记为 null（清空部门）', async () => {
    await updateMemberProfile(ctx, 'target-user', { department: '' })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.profile_updated', 'user', 'target-user', {
      department: null,
    })
  })

  it('无任何字段 → 直接返回，不写审计', async () => {
    await updateMemberProfile(ctx, 'target-user', {})
    expect(mockAudit).not.toHaveBeenCalled()
  })
})

describe('removeMember 护栏（4.8.12）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.adminIds = ['admin-1', 'target-user']
  })

  it('移除自己 → 抛错，且不封禁账号', async () => {
    await expect(removeMember(ctx, 'admin-1')).rejects.toThrow('不能移除自己')
    expect(banSpy).not.toHaveBeenCalled()
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('目标是最后一名管理员 → 抛错，且不封禁账号', async () => {
    state.adminIds = ['target-user']
    await expect(removeMember(ctx, 'target-user')).rejects.toThrow('不能移除最后一名管理员')
    expect(banSpy).not.toHaveBeenCalled()
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('仍有其他管理员 → 移除成功：封禁登录 + 写 member.removed 审计', async () => {
    await removeMember(ctx, 'target-user')
    expect(banSpy).toHaveBeenCalledWith('target-user', { ban_duration: '876600h' })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.removed', 'user', 'target-user', {})
  })

  it('目标不是管理员（组织仅一名 Admin 是别人）→ 可正常移除', async () => {
    state.adminIds = ['admin-1']
    await removeMember(ctx, 'target-user')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'member.removed', 'user', 'target-user', {})
  })
})
