/**
 * L2 测试 · WF-6 助理编排卡片（方案 A：内联，非弹窗）
 *
 * 卡片是两道人工闸的载体——按钮在错误的阶段出现或消失，
 * 要么用户点不到下一步，要么会在校验没过时把流程发布出去。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantOrchestrateCard, type OrchestrateState } from '@/components/views/assistant-orchestrate-card'

const noop = () => {}
const baseHandlers = {
  onDraftWorkflow: noop, onPublishWorkflow: noop, onPublishAgent: noop,
  onGotoSchedule: noop, onOpenWorkflow: noop,
}

const wf = (over: Partial<NonNullable<OrchestrateState['workflow']>> = {}) => ({
  id: 'w1', name: '查找AI大事件', nodeCount: 4, edgeCount: 3,
  pendingAbilityNodes: [], valid: true, validation: [], ...over,
})

const setup = (state: OrchestrateState, handlers = {}) =>
  render(<AssistantOrchestrateCard state={state} {...baseHandlers} {...handlers} />)

describe('按钮随阶段推进', () => {
  it('plan → 只出「开始执行」', () => {
    setup({ stage: 'plan', description: 'x' })
    expect(screen.getByRole('button', { name: /开始执行/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /确认发布工作流/ })).toBeNull()
  })

  it('workflow-drafted → 出「确认发布工作流」', () => {
    setup({ stage: 'workflow-drafted', description: 'x', workflow: wf() })
    expect(screen.getByRole('button', { name: /确认发布工作流/ })).toBeTruthy()
  })

  it('agent-drafted → 出「确认发布数字员工」', () => {
    setup({ stage: 'agent-drafted', description: 'x', workflow: wf(), agent: { id: 'a1', name: 'X · 定时执行' } })
    expect(screen.getByRole('button', { name: /确认发布数字员工/ })).toBeTruthy()
  })

  it('done → 出「去配置定时执行」', () => {
    setup({ stage: 'done', description: 'x', workflow: wf(), agent: { id: 'a1', name: 'A' } })
    expect(screen.getByRole('button', { name: /去配置定时执行/ })).toBeTruthy()
  })
})

describe('发布前的风险必须让用户看见', () => {
  // 🔴 校验没过还能点发布，等于把注定跑失败的流程送上线
  it('校验未通过 → 发布按钮禁用并说明原因', () => {
    setup({
      stage: 'workflow-drafted', description: 'x',
      workflow: wf({ valid: false, validation: [{ message: '存在孤立节点' }] }),
    })
    expect(screen.getByRole('button', { name: /确认发布工作流/ })).toBeDisabled()
    expect(screen.getByText(/存在孤立节点/)).toBeTruthy()
  })

  // Copilot 匹配不到 Skill 时会降级为 llm 节点，跑起来是模型在编——发布前必须知情
  it('有降级节点 → 明确提示内容可能是编的', () => {
    setup({
      stage: 'workflow-drafted', description: 'x',
      workflow: wf({ pendingAbilityNodes: ['联网检索（需接入能力）'] }),
    })
    expect(screen.getByText(/模型代为处理/)).toBeTruthy()
    // 这不该拦住发布，只是知情
    expect(screen.getByRole('button', { name: /确认发布工作流/ })).not.toBeDisabled()
  })

  it('无审批权限 → 说明需管理员通过，且不给「去配置定时」按钮', () => {
    setup({ stage: 'done', description: 'x', workflow: wf(), agent: { id: 'a1', name: 'A' }, pendingReview: true })
    expect(screen.getByText(/需管理员通过/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /去配置定时执行/ })).toBeNull()
  })
})

describe('执行中与失败', () => {
  it('busy → 按钮禁用且显示进行中文案', () => {
    setup({ stage: 'plan', description: 'x', busy: true })
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toContain('正在生成流程')
  })

  // 失败停在当前步、保留已完成部分，用户重试即可，不必从头再说一遍需求
  it('失败 → 显示原因，且按钮仍可重试', () => {
    setup({ stage: 'workflow-drafted', description: 'x', workflow: wf(), error: '发布工作流失败' })
    expect(screen.getByText('发布工作流失败')).toBeTruthy()
    expect(screen.getByRole('button', { name: /确认发布工作流/ })).not.toBeDisabled()
  })
})

describe('交互', () => {
  it('点「开始执行」触发生成', async () => {
    const onDraftWorkflow = vi.fn()
    setup({ stage: 'plan', description: 'x' }, { onDraftWorkflow })
    await userEvent.click(screen.getByRole('button', { name: /开始执行/ }))
    expect(onDraftWorkflow).toHaveBeenCalledOnce()
  })

  it('点工作流名可跳去查看（发布前能先看看生成了什么）', async () => {
    const onOpenWorkflow = vi.fn()
    setup({ stage: 'workflow-drafted', description: 'x', workflow: wf() }, { onOpenWorkflow })
    await userEvent.click(screen.getByText(/查找AI大事件/))
    expect(onOpenWorkflow).toHaveBeenCalledWith('w1')
  })
})
