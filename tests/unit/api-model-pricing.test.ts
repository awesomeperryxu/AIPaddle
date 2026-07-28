/**
 * L3 集成测试 · 4.8.17c 定价 API（GET/POST /api/model-pricing、DELETE /[id]）
 * 覆盖：读放开给已登录用户 / 写仅平台超管 / 入参校验 / 同档冲突 409 / 审计留痕。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/model-pricing', () => ({
  listModelPricing: vi.fn(),
  addModelPricing: vi.fn(),
  deleteModelPricing: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { GET, POST } from '@/app/api/model-pricing/route'
import { DELETE } from '@/app/api/model-pricing/[id]/route'
import { listModelPricing, addModelPricing, deleteModelPricing } from '@/lib/data/model-pricing'
import { writeAudit } from '@/lib/data/audit'

const mockCtx = vi.mocked(getRequestContext)
const mockPlatform = vi.mocked(isPlatformAdmin)
const mockList = vi.mocked(listModelPricing)
const mockAdd = vi.mocked(addModelPricing)
const mockDel = vi.mocked(deleteModelPricing)
const mockAudit = vi.mocked(writeAudit)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['User'] }
const post = (b: unknown) => POST(new Request('http://x/api/model-pricing', { method: 'POST', body: JSON.stringify(b) }))
const VALID = { provider: 'platform-env', model: 'qwen-plus', inputPer1k: 0.0008, outputPer1k: 0.0048 }

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(adminCtx)
  mockPlatform.mockResolvedValue(true)
})

describe('GET /api/model-pricing', () => {
  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
  })

  it('普通成员也可读（成本展示要用）→ 200', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    mockList.mockResolvedValueOnce([])
    expect((await GET()).status).toBe(200)
  })
})

describe('POST /api/model-pricing', () => {
  it('非平台超管 → 403，且不写库', async () => {
    mockPlatform.mockResolvedValueOnce(false)
    expect((await post(VALID)).status).toBe(403)
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('单价非数字 → 400（防把 "0.0008" 字符串写进库）', async () => {
    expect((await post({ ...VALID, inputPer1k: '0.0008' })).status).toBe(400)
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('缺 provider/model → 400', async () => {
    expect((await post({ inputPer1k: 1, outputPer1k: 2 })).status).toBe(400)
  })

  it('平台超管新增 → 201 且写 pricing.added 审计', async () => {
    mockAdd.mockResolvedValueOnce({
      id: 'p1', ...VALID, currency: 'CNY', effectiveFrom: '2026-07-28T00:00:00Z', sourceNote: null,
    })
    const res = await post(VALID)
    expect(res.status).toBe(201)
    expect(mockAudit).toHaveBeenCalledWith(adminCtx, 'pricing.added', 'model_pricing', 'p1', expect.anything())
  })

  it('同 provider+model+生效时间已存在 → 409', async () => {
    mockAdd.mockRejectedValueOnce(new Error('该供应商+模型在此生效时间已有定价，请换一个生效时间'))
    const res = await post(VALID)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('conflict')
  })

  it('数据层校验失败（负单价）→ 400', async () => {
    mockAdd.mockRejectedValueOnce(new Error('输入单价必须为非负数'))
    expect((await post({ ...VALID, inputPer1k: -1 })).status).toBe(400)
  })
})

describe('DELETE /api/model-pricing/[id]', () => {
  const del = (id: string) =>
    DELETE(new Request(`http://x/api/model-pricing/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) })

  it('非平台超管 → 403', async () => {
    mockPlatform.mockResolvedValueOnce(false)
    expect((await del('p1')).status).toBe(403)
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('删除成功 → 200 并写审计', async () => {
    mockDel.mockResolvedValueOnce(true)
    expect((await del('p1')).status).toBe(200)
    expect(mockAudit).toHaveBeenCalledWith(adminCtx, 'pricing.deleted', 'model_pricing', 'p1', {})
  })

  it('不存在或已删 → 404，不写审计', async () => {
    mockDel.mockResolvedValueOnce(false)
    expect((await del('gone')).status).toBe(404)
    expect(mockAudit).not.toHaveBeenCalled()
  })
})
