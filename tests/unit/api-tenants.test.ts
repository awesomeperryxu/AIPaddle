import { describe, it, expect, vi, beforeEach } from 'vitest'

// ADR-010：平台租户 API 必须由 isPlatformAdmin 兜住——非平台超管一律 403。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/tenants', () => ({
  listAllTenants: vi.fn().mockResolvedValue([]),
  provisionTenant: vi.fn().mockResolvedValue({ id: 't1', name: 'X' }),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { GET, POST } from '@/app/api/tenants/route'

const mockCtx = vi.mocked(getRequestContext)
const mockIsPlat = vi.mocked(isPlatformAdmin)
const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] as const }
const req = (b: unknown) => new Request('http://localhost/api/tenants', { method: 'POST', body: JSON.stringify(b) })

describe('平台租户 API 授权门（ADR-010）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('非平台超管 GET → 403', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockIsPlat.mockResolvedValue(false)
    expect((await GET()).status).toBe(403)
  })

  it('非平台超管 POST 开通 → 403', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockIsPlat.mockResolvedValue(false)
    const res = await POST(req({ name: 'X', code: 'x1', contactEmail: 'a@b.com', planType: 'standard', tokenQuota: 1000 }))
    expect(res.status).toBe(403)
  })

  it('平台超管 GET → 200', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockIsPlat.mockResolvedValue(true)
    expect((await GET()).status).toBe(200)
  })
})
