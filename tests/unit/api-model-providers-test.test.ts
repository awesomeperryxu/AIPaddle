/**
 * L3 集成测试 · app/api/model-providers/[id]/test（POST 连通性测试）
 * 覆盖：401/403 门控 / 404 供应商不存在 / 200 透传探测结果 / 明文 Key 不进返回体
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/model-providers', () => ({ getProviderApiKey: vi.fn() }))
vi.mock('@/lib/ai/provider-connectivity', () => ({ testProviderConnectivity: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { POST } from '@/app/api/model-providers/[id]/test/route'
import { getProviderApiKey } from '@/lib/data/model-providers'
import { testProviderConnectivity } from '@/lib/ai/provider-connectivity'

const mockCtx = vi.mocked(getRequestContext)
const mockKey = vi.mocked(getProviderApiKey)
const mockProbe = vi.mocked(testProviderConnectivity)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['User'] }

beforeEach(() => {
  vi.clearAllMocks()
  mockKey.mockResolvedValue({ provider: 'openai-compat', baseUrl: 'https://x/v1', apiKey: 'sk-SECRET' })
  mockProbe.mockResolvedValue({ ok: true, status: 200, message: '连通正常', models: ['qwen-plus'] })
})

const req = () => new Request('http://localhost/api/model-providers/p1/test', { method: 'POST' })
const params = (id = 'p1') => ({ params: Promise.resolve({ id }) })

describe('POST /api/model-providers/[id]/test', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await POST(req(), params())).status).toBe(401)
    expect(mockKey).not.toHaveBeenCalled()
  })
  it('403 — User 不解密 Key', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await POST(req(), params())).status).toBe(403)
    expect(mockKey).not.toHaveBeenCalled()
  })
  it('404 — 供应商不存在', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockKey.mockResolvedValue(null)
    const res = await POST(req(), params())
    expect(res.status).toBe(404)
    expect(mockProbe).not.toHaveBeenCalled()
  })
  it('200 — 透传探测结果', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await POST(req(), params())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.ok).toBe(true)
    expect(body.result.models).toEqual(['qwen-plus'])
    expect(mockProbe).toHaveBeenCalledWith({ provider: 'openai-compat', baseUrl: 'https://x/v1', apiKey: 'sk-SECRET' })
  })
  it('200 — 明文 Key 绝不进返回体', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await POST(req(), params())
    expect(JSON.stringify(await res.json())).not.toContain('sk-SECRET')
  })
})
