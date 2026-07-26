/**
 * L3 集成测试 · app/api/model-providers/settings（GET + PUT）
 * 覆盖：401/403 门控 / 200 读取 / 合法槽写入 / 非法槽 400 / 缺省槽跳过
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/model-providers', () => ({
  getModelSettings: vi.fn(),
  setModelSettings: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, PUT } from '@/app/api/model-providers/settings/route'
import { getModelSettings, setModelSettings } from '@/lib/data/model-providers'

const mockCtx = vi.mocked(getRequestContext)
const mockGet = vi.mocked(getModelSettings)
const mockSet = vi.mocked(setModelSettings)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['User'] }

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ llm: { providerId: 'p1', model: 'qwen-plus' } })
  mockSet.mockResolvedValue(undefined)
})

const putReq = (body: unknown) =>
  new Request('http://localhost/api/model-providers/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

describe('GET /api/model-providers/settings', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
  it('403 — User', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await GET()).status).toBe(403)
    expect(mockGet).not.toHaveBeenCalled()
  })
  it('200 — 返回设置', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).settings.llm.model).toBe('qwen-plus')
  })
})

describe('PUT /api/model-providers/settings', () => {
  it('403 — User 不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await PUT(putReq({ llm: { providerId: 'p1', model: 'm' } }))).status).toBe(403)
    expect(mockSet).not.toHaveBeenCalled()
  })
  it('400 — 槽缺 model', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await PUT(putReq({ llm: { providerId: 'p1' } }))).status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })
  it('200 — 只落合法槽，缺省/清空槽跳过', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PUT(putReq({
      llm: { providerId: 'p1', model: 'qwen-max' },
      embedding: null,
      rerank: { providerId: 'p2', model: 'gte-rerank' },
    }))
    expect(res.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith(adminCtx, {
      llm: { providerId: 'p1', model: 'qwen-max' },
      rerank: { providerId: 'p2', model: 'gte-rerank' },
    })
  })
  it('200 — 接受 { settings } 包裹形式', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    await PUT(putReq({ settings: { llm: { providerId: 'p1', model: 'qwen-max' } } }))
    expect(mockSet).toHaveBeenCalledWith(adminCtx, { llm: { providerId: 'p1', model: 'qwen-max' } })
  })
})
