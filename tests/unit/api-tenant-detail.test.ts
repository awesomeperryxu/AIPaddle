/**
 * L3 集成测试 · 4.8.15a/b 租户详情与配额编辑（GET/PATCH /api/tenants/[id]）
 * 覆盖：401/403 平台超管门控 · 详情 404 · 基本信息与配额校验 · 停启用与编辑共存 · 审计留痕。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/tenants', () => ({
  setTenantStatus: vi.fn(),
  deleteTenant: vi.fn(),
  getTenantDetail: vi.fn(),
  updateTenantByPlatform: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { GET, PATCH } from '@/app/api/tenants/[id]/route'
import { getTenantDetail, updateTenantByPlatform, setTenantStatus } from '@/lib/data/tenants'
import { writeAudit } from '@/lib/data/audit'

const mockCtx = vi.mocked(getRequestContext)
const mockPlatform = vi.mocked(isPlatformAdmin)
const mockDetail = vi.mocked(getTenantDetail)
const mockUpdate = vi.mocked(updateTenantByPlatform)
const mockStatus = vi.mocked(setTenantStatus)
const mockAudit = vi.mocked(writeAudit)

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body?: unknown) =>
  new Request('http://localhost/api/tenants/t1', {
    method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body),
  })

const DETAIL = {
  id: 't1', name: '某企业', code: 'demo', planType: 'free' as const,
  tokenQuota: 1_000_000, qpsLimit: 10, status: 'active' as const,
  contactName: '张三', contactEmail: 'a@b.com', createdAt: '2026-07-01',
  storageQuota: 21474836480, memberCount: 5, agentCount: 3,
  tokensUsed30d: 12345, storageUsed: 1024,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(ctx)
  mockPlatform.mockResolvedValue(true)
})

describe('GET /api/tenants/[id]（4.8.15a）', () => {
  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://x'), params('t1'))).status).toBe(401)
  })

  it('非平台超管 → 403，且不触数据层', async () => {
    mockPlatform.mockResolvedValueOnce(false)
    expect((await GET(new Request('http://x'), params('t1'))).status).toBe(403)
    expect(mockDetail).not.toHaveBeenCalled()
  })

  it('平台超管 → 200，返回详情含用量统计', async () => {
    mockDetail.mockResolvedValueOnce(DETAIL)
    const res = await GET(new Request('http://x'), params('t1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tenant.memberCount).toBe(5)
    expect(body.tenant.tokensUsed30d).toBe(12345)
  })

  it('租户不存在或已注销 → 404', async () => {
    mockDetail.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://x'), params('t1'))).status).toBe(404)
  })
})

describe('PATCH /api/tenants/[id] · 基本信息与配额（4.8.15a/b）', () => {
  it('非平台超管 → 403，且不触数据层', async () => {
    mockPlatform.mockResolvedValueOnce(false)
    expect((await PATCH(req({ name: 'x' }), params('t1'))).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('改基本信息 + 配额 → 200 并透传，写 tenant.updated 审计', async () => {
    mockUpdate.mockResolvedValueOnce(undefined)
    const res = await PATCH(
      req({ name: '新名', contactName: '李四', contactEmail: 'x@y.com', tokenQuota: 2000, storageQuota: 100, qpsLimit: 5 }),
      params('t1'),
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('t1', {
      name: '新名', contactName: '李四', contactEmail: 'x@y.com',
      tokenQuota: 2000, storageQuota: 100, qpsLimit: 5,
    })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'tenant.updated', 'tenant', 't1', expect.anything())
  })

  it('配额传字符串 → 400（防前端漏转数字把 "abc" 写进库）', async () => {
    const res = await PATCH(req({ tokenQuota: '2000' }), params('t1'))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('数据层校验失败（负数配额）→ 400 并透出中文原因', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Token 配额必须为非负整数（0 表示不限制）'))
    const res = await PATCH(req({ tokenQuota: -1 }), params('t1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('非负整数')
  })

  it('邮箱格式非法 → 400', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('联系邮箱格式非法'))
    expect((await PATCH(req({ contactEmail: 'bad' }), params('t1'))).status).toBe(400)
  })

  it('租户已注销 → 404', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('租户不存在或已注销'))
    expect((await PATCH(req({ name: 'x' }), params('t1'))).status).toBe(404)
  })

  it('停启用仍照旧工作（ADR-010 既有能力不回归）', async () => {
    mockStatus.mockResolvedValueOnce(undefined)
    const res = await PATCH(req({ status: 'suspended' }), params('t1'))
    expect(res.status).toBe(200)
    expect(mockStatus).toHaveBeenCalledWith('t1', 'suspended')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'tenant.status_changed', 'tenant', 't1', { status: 'suspended' })
  })

  it('status 与编辑字段同时传 → 两条路径都执行', async () => {
    mockStatus.mockResolvedValueOnce(undefined)
    mockUpdate.mockResolvedValueOnce(undefined)
    const res = await PATCH(req({ status: 'active', name: '新名' }), params('t1'))
    expect(res.status).toBe(200)
    expect(mockStatus).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith('t1', { name: '新名' })
  })

  it('空 body → 200 且不写库（幂等无操作）', async () => {
    const res = await PATCH(req({}), params('t1'))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockStatus).not.toHaveBeenCalled()
  })
})
