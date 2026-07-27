/**
 * L3 组件测试 · BUG-78 修复：模版「配置工具依赖」依赖工具逐项可选
 * 复现路径：使用模板 → 创建 → 进入依赖阶段 → 三个工具默认全选 →
 *          取消一个 → 「安装 N 个工具」计数更新 → 安装只创建勾选项。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { TemplatesView } from '@/components/views/templates-view'
import { apiFetch } from '@/lib/api/client'
import type { Template } from '@/lib/data/templates'

const mockApi = vi.mocked(apiFetch)

const tpl: Template = {
  id: 't1', name: 'youtube 数据统计', type: 'agent', category: '数据分析',
  description: '统计 YouTube 数据', icon: '📊', iconBackground: '#eee', tags: [],
  dsl: { requiredSkills: [
    { key: 'k1', name: '工具一' }, { key: 'k2', name: '工具二' }, { key: 'k3', name: '工具三' },
  ] },
  source: 'builtin', license: 'MIT', isBuiltIn: true, createdAt: '2026-07-27',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.mockImplementation((path: string) =>
    path.includes('/api/agents') ? Promise.resolve({ agent: { id: 'a1' } } as never) : Promise.resolve({} as never))
})

async function gotoDepsPhase() {
  render(<TemplatesView initialTemplates={[tpl]} />)
  const card = screen.getByText('youtube 数据统计').closest('.group') as HTMLElement
  fireEvent.mouseEnter(card)                                        // hover 才显示操作浮层
  fireEvent.click(await screen.findByText('使用该模板'))            // 打开弹窗（名称已预填模板名）
  fireEvent.click(await screen.findByText('创建'))                   // 创建 → 进入依赖阶段
  await screen.findByText('配置工具依赖')
}

describe('BUG-78 模版依赖工具逐项可选', () => {
  it('三个工具默认全选，按钮显示「安装 3 个工具」', async () => {
    await gotoDepsPhase()
    expect(screen.getByLabelText('选择 工具一')).toBeChecked()
    expect(screen.getByLabelText('选择 工具二')).toBeChecked()
    expect(screen.getByLabelText('选择 工具三')).toBeChecked()
    expect(screen.getByText('安装 3 个工具')).toBeInTheDocument()
  })

  it('取消一个 → 计数变「安装 2 个工具」；安装只创建勾选的 2 个', async () => {
    await gotoDepsPhase()
    fireEvent.click(screen.getByLabelText('选择 工具二'))            // 取消工具二
    expect(await screen.findByText('安装 2 个工具')).toBeInTheDocument()

    fireEvent.click(screen.getByText('安装 2 个工具'))
    await waitFor(() => {
      const skillCalls = mockApi.mock.calls.filter(([p]) => String(p).includes('/api/skills'))
      expect(skillCalls).toHaveLength(2)                            // 只装勾选的 2 个
    })
    const names = mockApi.mock.calls
      .filter(([p]) => String(p).includes('/api/skills'))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).name)
    expect(names).toEqual(['工具一', '工具三'])                      // 未勾选的工具二未创建
  })

  it('全部取消 → 按钮禁用且显示「请勾选工具」', async () => {
    await gotoDepsPhase()
    fireEvent.click(screen.getByLabelText('选择 工具一'))
    fireEvent.click(screen.getByLabelText('选择 工具二'))
    fireEvent.click(screen.getByLabelText('选择 工具三'))
    const btn = await screen.findByText('请勾选工具')
    expect(btn.closest('button')).toBeDisabled()
  })
})
