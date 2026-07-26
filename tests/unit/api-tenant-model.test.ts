/**
 * L3 集成测试 · app/api/tenant/model（GET + PATCH）
 * 覆盖：401 未登录 / 403 权限不足 / 200 GET 返回 model+options /
 *       400 非法 model / 403 无 tenant:manage 不触数据层
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/tenant', () => ({
  getTenantDefaultModel: vi.fn(),
  setTenantDefaultModel: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, PATCH } from '@/app/api/tenant/model/route'
import { getTenantDefaultModel, setTenantDefaultModel } from '@/lib/data/tenant'
import { AGENT_MODELS } from '@/lib/agents/config'

const mockCtx = vi.mocked(getRequestContext)
const mockGet = vi.mocked(getTenantDefaultModel)
const mockSet = vi.mocked(setTenantDefaultModel)

const adminCtx: RequestContext   = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const auditorCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Auditor'] }
const userCtx: RequestContext    = { userId: 'u4', orgId: 'org1', roles: ['User'] }

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue('qwen-plus')
  mockSet.mockResolvedValue(undefined)
})

const makeReq = (body: unknown) =>
  new Request('http://localhost/api/tenant/model', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/tenant/model', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('403 — User 无 tenant:read', async () => {
    mockCtx.mockResolvedValue(userCtx)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('200 — 返回 model + options', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.model).toBe('qwen-plus')
    expect(body.options).toEqual(AGENT_MODELS)
  })

  it('200 — Auditor 可读', async () => {
    mockCtx.mockResolvedValue(auditorCtx)
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/tenant/model', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await PATCH(makeReq({ model: 'qwen-max' }))
    expect(res.status).toBe(401)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('403 — Auditor 无 tenant:manage，不触数据层', async () => {
    mockCtx.mockResolvedValue(auditorCtx)
    const res = await PATCH(makeReq({ model: 'qwen-max' }))
    expect(res.status).toBe(403)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('400 — 非法 model，不触数据层', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ model: 'gpt-4o' }))
    expect(res.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('400 — model 缺失', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({}))
    expect(res.status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('200 — Admin 设置合法 model', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(makeReq({ model: 'qwen-max' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.model).toBe('qwen-max')
    expect(mockSet).toHaveBeenCalledWith(adminCtx, 'qwen-max')
  })
})
