/**
 * L3 集成测试 · app/api/model-providers（GET/POST + [id] PATCH/DELETE）
 * 覆盖：401 未登录 / 403 非 Admin 不触数据层 / 400 校验 / 201 创建 /
 *       409 加密不可用 / 200 编辑·软删 / 脱敏视图透传
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/model-providers', () => ({
  PROVIDER_TYPES: ['openai-compat', 'openai', 'anthropic', 'bedrock', 'gemini', 'custom'],
  listProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/model-providers/route'
import { PATCH, DELETE } from '@/app/api/model-providers/[id]/route'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
} from '@/lib/data/model-providers'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listProviders)
const mockCreate = vi.mocked(createProvider)
const mockUpdate = vi.mocked(updateProvider)
const mockDelete = vi.mocked(deleteProvider)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['User'] }
const auditorCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['Auditor'] }

const masked = {
  id: 'p1', provider: 'openai-compat' as const, credentialName: 'Qwen 主账号',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyMasked: '****abcd',
  models: ['qwen-plus'], enabled: true, createdAt: '2026-07-26',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([masked])
  mockCreate.mockResolvedValue(masked)
  mockUpdate.mockResolvedValue(undefined)
  mockDelete.mockResolvedValue(undefined)
})

const postReq = (body: unknown) =>
  new Request('http://localhost/api/model-providers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
const patchReq = (body: unknown) =>
  new Request('http://localhost/api/model-providers/p1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
const idParams = (id = 'p1') => ({ params: Promise.resolve({ id }) })

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/model-providers', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
  it('403 — User 无 provider:manage', async () => {
    mockCtx.mockResolvedValue(userCtx)
    const res = await GET()
    expect(res.status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })
  it('403 — Auditor 亦无权', async () => {
    mockCtx.mockResolvedValue(auditorCtx)
    expect((await GET()).status).toBe(403)
  })
  it('200 — Admin 返回脱敏清单', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.providers).toHaveLength(1)
    expect(body.providers[0].keyMasked).toBe('****abcd')
    expect(body.providers[0]).not.toHaveProperty('apiKey')
  })
})

describe('POST /api/model-providers', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await POST(postReq({ provider: 'openai', credentialName: 'x', apiKey: 'k' }))).status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })
  it('403 — User 不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    const res = await POST(postReq({ provider: 'openai', credentialName: 'x', apiKey: 'k' }))
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })
  it('400 — provider 非法', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await POST(postReq({ provider: 'wat', credentialName: 'x', apiKey: 'k' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
  it('400 — 凭证名为空', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await POST(postReq({ provider: 'openai', credentialName: '  ', apiKey: 'k' }))).status).toBe(400)
  })
  it('400 — apiKey 缺失', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await POST(postReq({ provider: 'openai', credentialName: 'x' }))).status).toBe(400)
  })
  it('201 — 创建成功，返回脱敏视图', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await POST(postReq({
      provider: 'openai-compat', credentialName: 'Qwen 主账号',
      apiKey: 'sk-real', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus'],
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.provider.keyMasked).toBe('****abcd')
    expect(mockCreate).toHaveBeenCalledWith(adminCtx, expect.objectContaining({
      provider: 'openai-compat', credentialName: 'Qwen 主账号', apiKey: 'sk-real',
    }))
  })
  it('409 — 主密钥缺失（数据层抛错）', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockCreate.mockRejectedValue(new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法保存模型 Key'))
    const res = await POST(postReq({ provider: 'openai', credentialName: 'x', apiKey: 'k' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toContain('MODEL_KEY_ENC_SECRET')
  })
})

describe('PATCH /api/model-providers/[id]', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await PATCH(patchReq({ enabled: false }), idParams())).status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('403 — User 不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await PATCH(patchReq({ enabled: false }), idParams())).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('400 — 凭证名清空为空串', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await PATCH(patchReq({ credentialName: '   ' }), idParams())).status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('200 — Admin 编辑（含启停/换Key）', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await PATCH(patchReq({ enabled: false, apiKey: 'sk-new', baseUrl: '' }), idParams())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, 'p1', expect.objectContaining({
      enabled: false, apiKey: 'sk-new', baseUrl: null,
    }))
  })
  it('200 — apiKey 空串不透传（保留原 Key）', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    await PATCH(patchReq({ apiKey: '', credentialName: '改个名' }), idParams())
    const arg = mockUpdate.mock.calls[0][2]
    expect(arg).not.toHaveProperty('apiKey')
    expect(arg.credentialName).toBe('改个名')
  })
  it('409 — 换 Key 时加密不可用', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockUpdate.mockRejectedValue(new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法更新模型 Key'))
    expect((await PATCH(patchReq({ apiKey: 'sk-x' }), idParams())).status).toBe(409)
  })
})

describe('DELETE /api/model-providers/[id]', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await DELETE(new Request('http://localhost/api/model-providers/p1', { method: 'DELETE' }), idParams())).status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('403 — User 不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await DELETE(new Request('http://localhost/api/model-providers/p1', { method: 'DELETE' }), idParams())).status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('200 — Admin 软删', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await DELETE(new Request('http://localhost/api/model-providers/p1', { method: 'DELETE' }), idParams())
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(adminCtx, 'p1')
  })
})
