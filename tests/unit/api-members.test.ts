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
}))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/members/route'
import { PATCH } from '@/app/api/members/[id]/route'
import { listMembers, setMemberStatus } from '@/lib/data/members'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listMembers)
const mockSetStatus = vi.mocked(setMemberStatus)

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
