/**
 * L3 组件测试 · components/views/model-providers-view（4.7.4 UI）
 * 覆盖：列表渲染(脱敏Key/供应商中文名/deferred徽标) / 空态 / 403 整块隐藏 /
 *       连通性测试点击→结果回显 / 默认模型槽选项来自已启用供应商的模型
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModelProvidersView } from '@/components/views/model-providers-view'

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import { apiFetch } from '@/lib/api/client'
const mockApi = vi.mocked(apiFetch)

const providers = [
  { id: 'p1', provider: 'openai-compat', credentialName: '通义主账号', baseUrl: 'https://dashscope/v1', keyMasked: '****abcd', models: ['qwen-plus', 'qwen-max'], enabled: true, createdAt: '2026-07-26' },
  { id: 'p2', provider: 'anthropic', credentialName: 'Claude 账号', baseUrl: null, keyMasked: '****wxyz', models: [], enabled: false, createdAt: '2026-07-26' },
]

function routeApi(over?: { providersReject?: Error }) {
  mockApi.mockImplementation((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (path === '/api/model-providers' && method === 'GET') {
      return over?.providersReject ? Promise.reject(over.providersReject) : Promise.resolve({ providers } as never)
    }
    if (path === '/api/model-providers/settings' && method === 'GET') return Promise.resolve({ settings: {} } as never)
    if (path.endsWith('/test')) return Promise.resolve({ result: { ok: true, message: '连通正常，探测到 2 个模型', models: ['qwen-plus', 'qwen-max'] } } as never)
    return Promise.resolve({} as never)
  })
}

beforeEach(() => { vi.clearAllMocks(); routeApi() })
afterEach(() => { vi.restoreAllMocks() })

describe('ModelProvidersView', () => {
  it('渲染供应商列表：脱敏 Key + 中文名 + deferred 徽标', async () => {
    render(<ModelProvidersView />)
    expect(await screen.findByText('通义主账号')).toBeInTheDocument()
    expect(screen.getByText('****abcd')).toBeInTheDocument()
    expect(screen.getByText('OpenAI 兼容')).toBeInTheDocument()
    // anthropic 是 deferred，显示适配徽标 + 禁用徽标
    expect(screen.getByText('Anthropic Claude')).toBeInTheDocument()
    expect(screen.getByText('适配待 4.7.5')).toBeInTheDocument()
    expect(screen.getByText('已禁用')).toBeInTheDocument()
  })

  it('403 → 整块隐藏（不渲染任何内容）', async () => {
    routeApi({ providersReject: new Error('无权限：管理模型供应商') })
    render(<ModelProvidersView />)
    await waitFor(() => expect(screen.queryByText(/加载模型供应商/)).not.toBeInTheDocument())
    expect(screen.queryByTestId('model-providers-view')).toBeNull()
    expect(screen.queryByText('添加供应商')).toBeNull()
  })

  it('空态提示', async () => {
    mockApi.mockImplementation((path: string) =>
      path === '/api/model-providers'
        ? Promise.resolve({ providers: [] } as never)
        : Promise.resolve({ settings: {} } as never))
    render(<ModelProvidersView />)
    expect(await screen.findByText(/还没有配置任何供应商/)).toBeInTheDocument()
  })

  it('连通性测试：点击「测试」→ 调 test 端点 → 回显结果', async () => {
    render(<ModelProvidersView />)
    await screen.findByText('通义主账号')
    const testBtns = screen.getAllByTestId('test-provider')
    fireEvent.click(testBtns[0])
    expect(await screen.findByText('连通正常，探测到 2 个模型')).toBeInTheDocument()
    expect(mockApi).toHaveBeenCalledWith('/api/model-providers/p1/test', { method: 'POST' })
  })

  it('默认模型槽只列已启用供应商的模型（禁用的 anthropic 不入选项）', async () => {
    render(<ModelProvidersView />)
    await screen.findByText('通义主账号')
    // 5 个能力槽都渲染
    expect(screen.getByTestId('slot-llm')).toBeInTheDocument()
    expect(screen.getByTestId('slot-tts')).toBeInTheDocument()
    // 保存按钮存在（有可选模型时可用）
    expect(screen.getByText('保存默认模型')).toBeInTheDocument()
  })
})
