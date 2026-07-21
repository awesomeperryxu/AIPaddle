/**
 * L3 集成测试 · app/api/tenant（GET + PATCH）
 * 覆盖：401 未登录 / 403 权限不足 / 200 成功 / 400 非法输入
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/tenant', () => ({
  getTenant: vi.fn(),
  updateTenant: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, PATCH } from '@/app/api/tenant/route'
import { getTenant, updateTenant } from '@/lib/data/tenant'

const mockCtx = vi.mocked(getRequestContext)
const mockGet = vi.mocked(getTenant)
const mockUpdate = vi.mocked(updateTenant)

const adminCtx: RequestContext  = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const auditorCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Auditor'] }
const devCtx: RequestContext    = { userId: 'u3', orgId: 'org1', roles: ['Developer'] }
const userCtx: RequestContext   = { userId: 'u4', orgId: 'org1', roles: ['User'] }

const fakeTenant = {
  id: 'org1', name: '示范科技', shortName: '示范', industry: 'IT',
  companySize: '50-200', planType: 'pro' as const, status: 'active' as const,
  contactName: '张三', contactEmail: 'admin@demo.com', tokenQuota: 1000000,
  storageQuota: 21474836480, qpsLimit: 10, createdAt: '2026-01-01',
  usage: { members: 5, agents: 2, knowledgeBases: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue(fakeTenant)
  mockUpdate.mockResolvedValue(undefined)
})

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/tenant', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('403 — Developer 无权（非 Admin/Auditor）', async () => {
    mockCtx.mockResolvedValue(devCtx)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('403 — User 无权', async () => {
    mockCtx.mockResolvedValue(userCtx)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('200 — Admin 可读', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tenant.name).toBe('示范科技')
    expect(body.tenant.usage.members).toBe(5)
  })

  it('200 — Auditor 可读', async () => {
    mockCtx.mockResolvedValue(auditorCtx)
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/tenant', () => {
  const makeReq = (body: unknown) =>
    new Request('http://localhost/api/tenant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await PATCH(makeReq({}))
    expect(res.status).toBe(401)
  })

  it('403 — Auditor 不可改（只读）', async () => {
    mockCtx.mockResolvedValue(auditorCtx)
    const res = await PATCH(makeReq({ name: 'new' }))
    expect(res.status).toBe(403)
  })

  it('400 — name 为空字符串', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ name: '   ' }))
    expect(res.status).toBe(400)
  })

  it('400 — name 不是字符串', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ name: 123 }))
    expect(res.status).toBe(400)
  })

  it('200 — Admin 可更新名称', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ name: '新名称' }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ name: '新名称' }))
  })

  it('200 — 仅传 contactEmail 也可更新', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ contactEmail: 'new@test.com' }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ contactEmail: 'new@test.com' }))
  })

  it('200 — 空对象也合法（无操作）', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({}))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, {})
  })
})
