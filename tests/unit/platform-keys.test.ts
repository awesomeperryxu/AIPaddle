/**
 * L3 测试 · Key-2 平台超管跨租户 Key 总览
 * - 门控：未登录 401 / 非平台超管 403（**含租户 Admin**，这是隔离铁律的正面用例）
 * - 脱敏：响应绝不含明文或哈希
 * - 吊销：跨租户吊销落审计；已吊销回 404
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/platform-keys', () => ({
  listAllApiKeys: vi.fn(),
  revokeAnyApiKey: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllApiKeys, revokeAnyApiKey } from '@/lib/data/platform-keys'
import { writeAudit } from '@/lib/data/audit'
import { GET } from '@/app/api/platform/keys/route'
import { DELETE } from '@/app/api/platform/keys/[id]/route'

const mockCtx = vi.mocked(getRequestContext)
const mockIsPA = vi.mocked(isPlatformAdmin)
const mockList = vi.mocked(listAllApiKeys)
const mockRevoke = vi.mocked(revokeAnyApiKey)
const mockAudit = vi.mocked(writeAudit)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }

const key = {
  id: 'k1', name: '官网接入', keyPrefix: 'ap_ext_8b4bf30********', scope: 'agent',
  status: 'active' as const, lastUsedAt: null, createdAt: '2026-08-01', expiresAt: null,
  orgId: 'o2', orgName: '深圳市黑围裙酒店管理有限公司', orgStatus: 'active',
  extensionId: 'e1', extensionName: '官网在线咨询',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([key])
  mockRevoke.mockResolvedValue(key)
})

const idParams = (id = 'k1') => ({ params: Promise.resolve({ id }) })
const delReq = () => new Request('http://localhost/api/platform/keys/k1', { method: 'DELETE' })

describe('GET /api/platform/keys', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  // 🔴 核心用例：租户 Admin 角色再大也不能跨租户看 Key（ADR-002 隔离铁律）
  it('403 租户 Admin 非平台超管，且不触数据层', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockIsPA.mockResolvedValue(false)
    expect((await GET()).status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('200 平台超管拿到跨租户清单，且无明文/哈希', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockIsPA.mockResolvedValue(true)
    const body = await (await GET()).json()
    expect(body.keys[0].orgName).toBe('深圳市黑围裙酒店管理有限公司')
    expect(body.keys[0].keyPrefix).toContain('****')
    expect(JSON.stringify(body)).not.toMatch(/key_hash|ap_sk_live_[0-9a-f]{40}/)
  })
})

describe('DELETE /api/platform/keys/[id]', () => {
  it('403 非平台超管，且不触数据层', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockIsPA.mockResolvedValue(false)
    expect((await DELETE(delReq(), idParams())).status).toBe(403)
    expect(mockRevoke).not.toHaveBeenCalled()
  })

  it('404 已吊销/不存在', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockIsPA.mockResolvedValue(true)
    mockRevoke.mockResolvedValue(null)
    expect((await DELETE(delReq(), idParams())).status).toBe(404)
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('200 吊销成功并落审计（detail 记归属租户，不含明文）', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockIsPA.mockResolvedValue(true)
    const res = await DELETE(delReq(), idParams())
    expect(res.status).toBe(200)
    expect(mockAudit).toHaveBeenCalledWith(
      adminCtx, 'apikey.revoked_by_platform', 'api_key', 'k1',
      expect.objectContaining({ targetOrgName: '深圳市黑围裙酒店管理有限公司' }),
    )
    const detail = mockAudit.mock.calls[0][4]
    expect(JSON.stringify(detail)).not.toMatch(/key_hash|ap_sk_live_[0-9a-f]{40}/)
  })
})
