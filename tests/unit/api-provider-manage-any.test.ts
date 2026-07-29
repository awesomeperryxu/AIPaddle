/**
 * L3 集成测试 · 4.8.10 平台超管代租户配置模型供应商
 * 重点：跨租户写的门控不能松、Key 绝不出现在响应或审计里。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/platform', () => ({ isPlatformAdmin: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/model-providers', () => ({
  PROVIDER_TYPES: ['openai-compat', 'openai', 'anthropic', 'custom'],
  listProvidersForOrg: vi.fn(),
  createProviderForOrg: vi.fn(),
  deleteProviderForOrg: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { GET, POST } from '@/app/api/tenants/[id]/providers/route'
import { listProvidersForOrg, createProviderForOrg } from '@/lib/data/model-providers'
import { writeAudit } from '@/lib/data/audit'

const mockCtx = vi.mocked(getRequestContext)
const mockPlatform = vi.mocked(isPlatformAdmin)
const mockList = vi.mocked(listProvidersForOrg)
const mockCreate = vi.mocked(createProviderForOrg)
const mockAudit = vi.mocked(writeAudit)

const superCtx: RequestContext = { userId: 'su', orgId: 'org-platform', roles: ['Admin'] }
const tenantAdmin: RequestContext = { userId: 'u2', orgId: 'org-b', roles: ['Admin'] }
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (b: unknown, org = 'org-a') =>
  POST(new Request(`http://x/api/tenants/${org}/providers`, { method: 'POST', body: JSON.stringify(b) }), params(org))

const VALID = { provider: 'openai-compat', credentialName: '通义-生产', apiKey: 'sk-secret-value', baseUrl: 'https://dashscope/v1' }
const MASKED = {
  id: 'p1', provider: 'openai-compat', credentialName: '通义-生产',
  baseUrl: 'https://dashscope/v1', apiKeyMasked: 'sk-****alue', models: [], enabled: true, createdAt: '2026-07-29',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(superCtx)
  mockPlatform.mockResolvedValue(true)
})

describe('GET /api/tenants/[id]/providers', () => {
  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET(new Request('http://x'), params('org-a'))).status).toBe(401)
  })

  it('🔴 普通租户 Admin（非平台超管）→ 403，不得读他租户配置', async () => {
    mockCtx.mockResolvedValueOnce(tenantAdmin)
    mockPlatform.mockResolvedValueOnce(false)
    expect((await GET(new Request('http://x'), params('org-a'))).status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('平台超管 → 200，按指定 orgId 读取', async () => {
    mockList.mockResolvedValueOnce([MASKED])
    const res = await GET(new Request('http://x'), params('org-a'))
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith('org-a')
  })
})

describe('POST /api/tenants/[id]/providers', () => {
  it('🔴 非平台超管 → 403，且不触数据层', async () => {
    mockCtx.mockResolvedValueOnce(tenantAdmin)
    mockPlatform.mockResolvedValueOnce(false)
    expect((await post(VALID)).status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('供应商类型非法 → 400', async () => {
    expect((await post({ ...VALID, provider: 'no-such' })).status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('API Key 为空 → 400', async () => {
    expect((await post({ ...VALID, apiKey: '  ' })).status).toBe(400)
  })

  it('凭据名称为空 → 400', async () => {
    expect((await post({ ...VALID, credentialName: '' })).status).toBe(400)
  })

  it('平台超管代配 → 201，orgId 与 actorId 均正确透传', async () => {
    mockCreate.mockResolvedValueOnce(MASKED)
    const res = await post(VALID, 'org-a')
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith('org-a', 'su', expect.objectContaining({ apiKey: 'sk-secret-value' }))
  })

  it('🔴 响应体绝不含明文 Key', async () => {
    mockCreate.mockResolvedValueOnce(MASKED)
    const res = await post(VALID)
    expect(JSON.stringify(await res.json())).not.toContain('sk-secret-value')
  })

  it('🔴 跨租户写必须留痕，且审计 detail 不含 Key', async () => {
    mockCreate.mockResolvedValueOnce(MASKED)
    await post(VALID, 'org-a')
    expect(mockAudit).toHaveBeenCalledWith(
      superCtx, 'provider.configured_for_tenant', 'tenant', 'org-a', expect.anything(),
    )
    const detail = JSON.stringify(mockAudit.mock.calls[0]?.[4] ?? {})
    expect(detail).not.toContain('sk-secret-value')
  })

  it('未配加密主密钥 → 400（不静默存明文）', async () => {
    mockCreate.mockRejectedValueOnce(new Error('未配置 MODEL_KEY_ENC_SECRET，暂无法保存模型 Key'))
    expect((await post(VALID)).status).toBe(400)
  })
})
