/**
 * L2 单元测试 · lib/ai/provider-connectivity（通用 OpenAI 兼容探测）
 * 覆盖：非兼容供应商 deferred / 缺 BaseURL / 401 Key 无效 / 成功取模型 / 超时 / 网络错误 /
 *       openai 默认 base / 明文 Key 不出现在返回体
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testProviderConnectivity } from '@/lib/ai/provider-connectivity'

const okModels = () => new Response(
  JSON.stringify({ data: [{ id: 'qwen-plus' }, { id: 'qwen-max' }, { id: 123 }] }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe('testProviderConnectivity', () => {
  it('deferred — anthropic 原生适配未落地', async () => {
    const spy = vi.spyOn(global, 'fetch')
    const r = await testProviderConnectivity({ provider: 'anthropic', baseUrl: null, apiKey: 'k' })
    expect(r.ok).toBe(false)
    expect(r.deferred).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('deferred — bedrock / gemini 同样 deferred', async () => {
    for (const provider of ['bedrock', 'gemini'] as const) {
      const r = await testProviderConnectivity({ provider, baseUrl: 'https://x', apiKey: 'k' })
      expect(r.deferred).toBe(true)
    }
  })

  it('400语义 — openai-compat 缺 BaseURL', async () => {
    const r = await testProviderConnectivity({ provider: 'openai-compat', baseUrl: null, apiKey: 'k' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('Base URL')
  })

  it('openai 无 baseUrl 时用默认官方 base', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(okModels())
    const r = await testProviderConnectivity({ provider: 'openai', baseUrl: null, apiKey: 'sk-x' })
    expect(r.ok).toBe(true)
    expect(spy).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.anything())
  })

  it('成功 — 去尾斜杠、取模型 id、过滤非字符串', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(okModels())
    const r = await testProviderConnectivity({
      provider: 'openai-compat', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/', apiKey: 'sk-real',
    })
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.models).toEqual(['qwen-plus', 'qwen-max'])
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-real' })
  })

  it('401 — Key 无效', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('no', { status: 401 }))
    const r = await testProviderConnectivity({ provider: 'custom', baseUrl: 'https://x/v1', apiKey: 'bad' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
    expect(r.message).toContain('无效')
  })

  it('5xx — 上游异常', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('err', { status: 503 }))
    const r = await testProviderConnectivity({ provider: 'custom', baseUrl: 'https://x/v1', apiKey: 'k' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(503)
  })

  it('网络错误 — 收敛为 ok:false 不抛', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    const r = await testProviderConnectivity({ provider: 'custom', baseUrl: 'https://x/v1', apiKey: 'k' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('无法连接')
  })

  it('超时 — AbortError 归类为超时', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    const r = await testProviderConnectivity({ provider: 'custom', baseUrl: 'https://x/v1', apiKey: 'k' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('超时')
  })

  it('明文 Key 绝不出现在返回体', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(okModels())
    const r = await testProviderConnectivity({ provider: 'openai-compat', baseUrl: 'https://x/v1', apiKey: 'sk-SECRET' })
    expect(JSON.stringify(r)).not.toContain('sk-SECRET')
  })
})
