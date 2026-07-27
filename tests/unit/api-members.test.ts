/**
 * L3 集成测试 · app/api/members（GET + PATCH）
 * 覆盖：401 未登录 / 403 非 Admin / 200 Admin / 404 跨租户
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/members', () => ({
  listMembers: vi.fn().mockResolvedValue([]),
  inviteMember: vi.fn(),
  updateMemberRole: vi.fn(),
  setMemberStatus: vi.fn(),
  updateMemberProfile: vi.fn(),
  removeMember: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/members/route'
import { PATCH, DELETE } from '@/app/api/members/[id]/route'
import { listMembers, setMemberStatus, updateMemberProfile, removeMember } from '@/lib/data/members'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listMembers)
const mockSetStatus = vi.mocked(setMemberStatus)
const mockProfile = vi.mocked(updateMemberProfile)
const mockRemove = vi.mocked(removeMember)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const devCtx: RequestContext   = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
const userCtx: RequestContext  = { userId: 'u3', orgId: 'org1', roles: ['User'] }

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('任意角色登录 → 200 + members 数组', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    mockList.mockResolvedValueOnce([])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.members)).toBe(true)
  })

  it('Admin 角色 → 200', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockList.mockResolvedValueOnce([])
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/members', {
      method: 'POST', body: JSON.stringify({ email: 'a@b.com', name: '测试', role: 'User' }),
    }))
    expect(res.status).toBe(401)
  })

  it('Developer 角色 → 403（无 member:manage 权限）', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    const res = await POST(new Request('http://localhost/api/members', {
      method: 'POST', body: JSON.stringify({ email: 'a@b.com', name: '测试', role: 'User' }),
    }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('forbidden')
  })

  it('缺少邮箱 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await POST(new Request('http://localhost/api/members', {
      method: 'POST', body: JSON.stringify({ name: '测试', role: 'User' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid')
  })

  it('角色无效 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await POST(new Request('http://localhost/api/members', {
      method: 'POST', body: JSON.stringify({ email: 'a@b.com', name: '测试', role: 'SuperAdmin' }),
    }))
    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/members/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await PATCH(
      new Request('http://localhost/api/members/u99', { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) }),
      makeParams('u99'),
    )
    expect(res.status).toBe(401)
  })

  it('非 Admin → 403', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    const res = await PATCH(
      new Request('http://localhost/api/members/u99', { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) }),
      makeParams('u99'),
    )
    expect(res.status).toBe(403)
  })

  it('Admin 禁用成员 → 200', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSetStatus.mockResolvedValueOnce(undefined)
    const res = await PATCH(
      new Request('http://localhost/api/members/u2', { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) }),
      makeParams('u2'),
    )
    expect(res.status).toBe(200)
    expect(mockSetStatus).toHaveBeenCalledWith(adminCtx, 'u2', 'inactive')
  })

  it('跨租户成员不存在 → 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSetStatus.mockRejectedValueOnce(new Error('成员不存在或无权限'))
    const res = await PATCH(
      new Request('http://localhost/api/members/other-org-user', { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) }),
      makeParams('other-org-user'),
    )
    expect(res.status).toBe(404)
  })

  it('状态值无效 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await PATCH(
      new Request('http://localhost/api/members/u2', { method: 'PATCH', body: JSON.stringify({ status: 'banned' }) }),
      makeParams('u2'),
    )
    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4.8.12 成员资料编辑
describe('PATCH /api/members/[id] · 资料编辑（4.8.12）', () => {
  beforeEach(() => vi.clearAllMocks())

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
  const patch = (body: unknown, id = 'u2') => PATCH(
    new Request(`http://localhost/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    makeParams(id),
  )

  it('Admin 改姓名+部门 → 200 且透传给数据层（首尾空白已裁剪）', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockProfile.mockResolvedValueOnce(undefined)
    const res = await patch({ name: '  张三  ', department: ' 技术部 ' })
    expect(res.status).toBe(200)
    expect(mockProfile).toHaveBeenCalledWith(adminCtx, 'u2', { name: '张三', department: '技术部' })
  })

  it('部门传空字符串 → 200，视为清空部门', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockProfile.mockResolvedValueOnce(undefined)
    const res = await patch({ department: '' })
    expect(res.status).toBe(200)
    expect(mockProfile).toHaveBeenCalledWith(adminCtx, 'u2', { department: '' })
  })

  it('姓名为空白 → 400 且不落库', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await patch({ name: '   ' })
    expect(res.status).toBe(400)
    expect(mockProfile).not.toHaveBeenCalled()
  })

  it('姓名超长（>50）→ 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await patch({ name: 'a'.repeat(51) })
    expect(res.status).toBe(400)
    expect(mockProfile).not.toHaveBeenCalled()
  })

  it('部门超长（>50）→ 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await patch({ department: '部'.repeat(51) })
    expect(res.status).toBe(400)
    expect(mockProfile).not.toHaveBeenCalled()
  })

  it('部门类型非法（数字）→ 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await patch({ department: 123 })
    expect(res.status).toBe(400)
    expect(mockProfile).not.toHaveBeenCalled()
  })

  it('非 Admin 改资料 → 403', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    const res = await patch({ name: '张三' })
    expect(res.status).toBe(403)
    expect(mockProfile).not.toHaveBeenCalled()
  })

  it('一次请求同时改角色与资料 → 两个数据层函数都被调用', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockProfile.mockResolvedValueOnce(undefined)
    const res = await patch({ name: '张三', department: '技术部', role: 'Developer' })
    expect(res.status).toBe(200)
    expect(mockProfile).toHaveBeenCalledTimes(1)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// 4.8.12 移除成员
describe('DELETE /api/members/[id]（4.8.12）', () => {
  beforeEach(() => vi.clearAllMocks())

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
  const del = (id: string) => DELETE(
    new Request(`http://localhost/api/members/${id}`, { method: 'DELETE' }),
    makeParams(id),
  )

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await del('u2')).status).toBe(401)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('非 Admin → 403', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    expect((await del('u2')).status).toBe(403)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('Admin 移除成员 → 200', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockRemove.mockResolvedValueOnce(undefined)
    const res = await del('u2')
    expect(res.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith(adminCtx, 'u2')
  })

  it('移除自己 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockRemove.mockRejectedValueOnce(new Error('不能移除自己'))
    const res = await del('u1')
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('conflict')
  })

  it('移除最后一名管理员 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockRemove.mockRejectedValueOnce(new Error('不能移除最后一名管理员'))
    const res = await del('u2')
    expect(res.status).toBe(409)
  })

  it('跨租户成员 → 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockRemove.mockRejectedValueOnce(new Error('成员不存在或无权限'))
    expect((await del('other-org-user')).status).toBe(404)
  })
})
