/**
 * L2 单元测试 · 4.8.5 运行时按租户解析模型客户端
 * 验证：租户配了 OpenAI 兼容供应商 → 用租户（解密 Key）；
 *       未配 / 非兼容(anthropic) / 供应商查不到 / 解析异常 → 回退平台 env（不停服）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai', () => ({
  envModelClient: vi.fn(() => ({ baseURL: 'https://platform/v1', apiKey: 'plat-key', model: 'qwen-plus' })),
}))
vi.mock('@/lib/data/model-providers', () => ({
  getModelSettings: vi.fn(),
  getProviderApiKey: vi.fn(),
}))

import { resolveModelClient } from '@/lib/ai/resolve'
import { getModelSettings, getProviderApiKey } from '@/lib/data/model-providers'

const mockSettings = vi.mocked(getModelSettings)
const mockKey = vi.mocked(getProviderApiKey)
const ctx = { userId: 'u1', orgId: 'org1', roles: ['Admin'] } as never

beforeEach(() => {
  vi.clearAllMocks()
  mockSettings.mockResolvedValue({ llm: { providerId: 'p1', model: 'qwen-max' } })
  mockKey.mockResolvedValue({ provider: 'openai-compat', baseUrl: 'https://dashscope/v1/', apiKey: 'tenant-key' })
})

describe('resolveModelClient（4.8.5）', () => {
  it('租户配了 OpenAI 兼容 → 用租户(解密Key + 去尾斜杠 + 槽模型)', async () => {
    const c = await resolveModelClient(ctx, 'llm')
    expect(c).toEqual({ baseURL: 'https://dashscope/v1', apiKey: 'tenant-key', model: 'qwen-max', source: 'tenant' })
  })

  it('未配该能力槽 → 回退平台', async () => {
    mockSettings.mockResolvedValue({})
    const c = await resolveModelClient(ctx, 'llm')
    expect(c).toMatchObject({ apiKey: 'plat-key', source: 'platform' })
    expect(mockKey).not.toHaveBeenCalled()
  })

  it('非 OpenAI 兼容(anthropic 原生, 待4.7.5) → 回退平台', async () => {
    mockKey.mockResolvedValue({ provider: 'anthropic', baseUrl: null, apiKey: 'k' })
    const c = await resolveModelClient(ctx, 'llm')
    expect(c.source).toBe('platform')
  })

  it('供应商查不到(已删/无权) → 回退平台', async () => {
    mockKey.mockResolvedValue(null)
    const c = await resolveModelClient(ctx, 'llm')
    expect(c.source).toBe('platform')
  })

  it('openai 类型无 baseUrl → 用官方默认 base', async () => {
    mockKey.mockResolvedValue({ provider: 'openai', baseUrl: null, apiKey: 'sk-x' })
    const c = await resolveModelClient(ctx, 'llm')
    expect(c).toMatchObject({ baseURL: 'https://api.openai.com/v1', apiKey: 'sk-x', source: 'tenant' })
  })

  it('解析异常(getModelSettings 抛错) → 静默回退平台, 不抛', async () => {
    mockSettings.mockRejectedValue(new Error('db down'))
    const c = await resolveModelClient(ctx, 'llm')
    expect(c.source).toBe('platform')
  })
})
