/**
 * L3 集成测试 · DELETE /api/tenants/[id]（4.8.9 注销租户）
 * 覆盖：401 未登录 / 403 非平台超管 / 404 不存在 / 200 软删成功 + 审计。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/tenants', () => ({ setTenantStatus: vi.fn(), deleteTenant: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { DELETE } from '@/app/api/tenants/[id]/route'
import { deleteTenant } from '@/lib/data/tenants'
import { writeAudit } from '@/lib/data/audit'

const mockCtx = vi.mocked(getRequestContext)
const mockPlat = vi.mocked(isPlatformAdmin)
const mockDel = vi.mocked(deleteTenant)
const mockAudit = vi.mocked(writeAudit)

const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] } as never
const req = () => new Request('http://localhost/api/tenants/t1', { method: 'DELETE' })
const params = (id = 't1') => ({ params: Promise.resolve({ id }) })

beforeEach(() => { vi.clearAllMocks(); mockDel.mockResolvedValue(true) })

describe('DELETE /api/tenants/[id]', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await DELETE(req(), params())).status).toBe(401)
    expect(mockDel).not.toHaveBeenCalled()
  })
  it('403 非平台超管', async () => {
    mockCtx.mockResolvedValue(ctx); mockPlat.mockResolvedValue(false)
    expect((await DELETE(req(), params())).status).toBe(403)
    expect(mockDel).not.toHaveBeenCalled()
  })
  it('404 租户不存在/已注销', async () => {
    mockCtx.mockResolvedValue(ctx); mockPlat.mockResolvedValue(true); mockDel.mockResolvedValue(false)
    expect((await DELETE(req(), params())).status).toBe(404)
    expect(mockAudit).not.toHaveBeenCalled()
  })
  it('200 软删成功 + 写审计', async () => {
    mockCtx.mockResolvedValue(ctx); mockPlat.mockResolvedValue(true)
    expect((await DELETE(req(), params())).status).toBe(200)
    expect(mockDel).toHaveBeenCalledWith('t1')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'tenant.deleted', 'tenant', 't1', {})
  })
})
