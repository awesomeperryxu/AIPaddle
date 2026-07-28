/**
 * L3 集成测试 · 4.8.18 创建账号指定密码 + 自行改密
 * 重点锁三件事：服务端强度校验不可绕过、**密码绝不出现在响应里**、改密必须验原密码。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/members', () => ({ listMembers: vi.fn(), inviteMember: vi.fn() }))
vi.mock('@/lib/data/tenants', () => ({ listAllTenants: vi.fn(), provisionTenant: vi.fn() }))

const authState = vi.hoisted(() => ({
  email: 'me@aipaddle-test.local' as string | null,
  signInErr: null as { message: string } | null,
  updateErr: null as { message: string } | null,
  lastUpdate: null as Record<string, unknown> | null,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: authState.email ? { email: authState.email } : null } }),
      signInWithPassword: async () => ({ error: authState.signInErr }),
      updateUser: async (attrs: Record<string, unknown>) => {
        authState.lastUpdate = attrs
        return { error: authState.updateErr }
      },
    },
  }),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { POST as createMember } from '@/app/api/members/route'
import { POST as createTenant } from '@/app/api/tenants/route'
import { POST as changePassword } from '@/app/api/auth/password/route'
import { inviteMember } from '@/lib/data/members'
import { provisionTenant } from '@/lib/data/tenants'

const mockCtx = vi.mocked(getRequestContext)
const mockPlatform = vi.mocked(isPlatformAdmin)
const mockInvite = vi.mocked(inviteMember)
const mockProvision = vi.mocked(provisionTenant)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const req = (url: string, b: unknown) => new Request(`http://x${url}`, { method: 'POST', body: JSON.stringify(b) })

const MEMBER = { email: 'new@aipaddle-test.local', name: '新人', role: 'User' }
const TENANT = { name: '某企业', code: 'demo-x', contactName: '张三', contactEmail: 'a@b.com', tokenQuota: 1000 }

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(adminCtx)
  mockPlatform.mockResolvedValue(true)
  authState.email = 'me@aipaddle-test.local'
  authState.signInErr = null
  authState.updateErr = null
  authState.lastUpdate = null
})

describe('POST /api/members · 创建成员需指定密码（4.8.18a）', () => {
  it('未给密码 → 400，且不触数据层', async () => {
    const res = await createMember(req('/api/members', MEMBER))
    expect(res.status).toBe(400)
    expect(mockInvite).not.toHaveBeenCalled()
  })

  it('弱口令 → 400（服务端兜底，前端校验可被绕过）', async () => {
    const res = await createMember(req('/api/members', { ...MEMBER, password: 'admin123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('过于常见')
  })

  it('纯数字密码 → 400', async () => {
    expect((await createMember(req('/api/members', { ...MEMBER, password: '12345678' }))).status).toBe(400)
  })

  it('合格密码 → 201，密码透传数据层', async () => {
    mockInvite.mockResolvedValueOnce({
      id: 'm1', name: '新人', email: MEMBER.email, department: '', role: 'User',
      status: 'active', lastLogin: '2026-07-28',
    })
    const res = await createMember(req('/api/members', { ...MEMBER, password: 'Xk9#mQ2vLp' }))
    expect(res.status).toBe(201)
    expect(mockInvite).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ password: 'Xk9#mQ2vLp' }))
  })

  it('🔴 响应体绝不含密码', async () => {
    mockInvite.mockResolvedValueOnce({
      id: 'm1', name: '新人', email: MEMBER.email, department: '', role: 'User',
      status: 'active', lastLogin: '2026-07-28',
    })
    const res = await createMember(req('/api/members', { ...MEMBER, password: 'Xk9#mQ2vLp' }))
    expect(JSON.stringify(await res.json())).not.toContain('Xk9#mQ2vLp')
  })
})

describe('POST /api/tenants · 开通企业需指定管理员密码（4.8.18b）', () => {
  it('未给密码 → 400，且不开通', async () => {
    const res = await createTenant(req('/api/tenants', TENANT))
    expect(res.status).toBe(400)
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('弱口令 → 400，提示指明是管理员密码', async () => {
    const res = await createTenant(req('/api/tenants', { ...TENANT, adminPassword: 'password' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('管理员')
  })

  it('合格密码 → 201 且透传', async () => {
    mockProvision.mockResolvedValueOnce({
      id: 't1', name: '某企业', code: 'demo-x', planType: 'free', tokenQuota: 1000,
      qpsLimit: 10, status: 'active', contactName: '张三', contactEmail: 'a@b.com', createdAt: '2026-07-28',
    })
    const res = await createTenant(req('/api/tenants', { ...TENANT, adminPassword: 'Xk9#mQ2vLp' }))
    expect(res.status).toBe(201)
    expect(mockProvision).toHaveBeenCalledWith(expect.objectContaining({ adminPassword: 'Xk9#mQ2vLp' }))
    expect(JSON.stringify(await res.json())).not.toContain('Xk9#mQ2vLp')
  })
})

describe('POST /api/auth/password · 自行改密（4.8.18c）', () => {
  const body = { currentPassword: 'OldPass1!', newPassword: 'Xk9#mQ2vLp' }

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await changePassword(req('/api/auth/password', body))).status).toBe(401)
  })

  it('缺原密码 → 400（不允许凭会话直接改密）', async () => {
    const res = await changePassword(req('/api/auth/password', { newPassword: 'Xk9#mQ2vLp' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('原密码')
  })

  it('新密码不合格 → 400', async () => {
    expect((await changePassword(req('/api/auth/password', { ...body, newPassword: '12345678' }))).status).toBe(400)
  })

  it('新旧密码相同 → 400', async () => {
    const res = await changePassword(req('/api/auth/password', { currentPassword: 'Xk9#mQ2vLp', newPassword: 'Xk9#mQ2vLp' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('不能与原密码相同')
  })

  it('🔴 原密码错误 → 400，且不调用 updateUser（防会话被盗后改密踢走本人）', async () => {
    authState.signInErr = { message: 'Invalid login credentials' }
    const res = await changePassword(req('/api/auth/password', body))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toBe('原密码不正确')
    expect(authState.lastUpdate).toBeNull()
  })

  it('原密码正确 → 200 并更新', async () => {
    const res = await changePassword(req('/api/auth/password', body))
    expect(res.status).toBe(200)
    expect(authState.lastUpdate).toEqual({ password: 'Xk9#mQ2vLp' })
  })

  it('会话失效（取不到邮箱）→ 401', async () => {
    authState.email = null
    expect((await changePassword(req('/api/auth/password', body))).status).toBe(401)
  })
})
