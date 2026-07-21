/**
 * L2 单元测试 · lib/mcp/status.ts（ROADMAP 4.3.0）
 * 覆盖：合法流转链、每个动作的 from/to/权限、按状态可用动作。
 */
import { describe, it, expect } from 'vitest'
import { TRANSITIONS, actionsFor, ACTION_LABEL, type McpTransitionAction } from '@/lib/mcp/status'

describe('MCP 状态机', () => {
  it('审批主链 draft→pending→approved 登记正确', () => {
    expect(TRANSITIONS.submit).toMatchObject({ from: 'draft', to: 'pending', action: 'mcp:submit' })
    expect(TRANSITIONS.approve).toMatchObject({ from: 'pending', to: 'approved', action: 'mcp:review' })
  })

  it('驳回回 draft', () => {
    expect(TRANSITIONS.reject).toMatchObject({ from: 'pending', to: 'draft', action: 'mcp:review' })
  })

  it('禁用/启用：approved↔disabled，均为治理动作 mcp:review', () => {
    expect(TRANSITIONS.disable).toMatchObject({ from: 'approved', to: 'disabled', action: 'mcp:review' })
    expect(TRANSITIONS.enable).toMatchObject({ from: 'disabled', to: 'approved', action: 'mcp:review' })
  })

  it('actionsFor 按状态给出可用动作', () => {
    expect(actionsFor('draft')).toEqual(['submit'])
    expect(actionsFor('pending').sort()).toEqual(['approve', 'reject'])
    expect(actionsFor('approved')).toEqual(['disable'])
    expect(actionsFor('disabled')).toEqual(['enable'])
  })

  it('每个动作都有中文标签', () => {
    for (const a of Object.keys(TRANSITIONS) as McpTransitionAction[]) {
      expect(ACTION_LABEL[a]).toBeTruthy()
    }
  })

  it('不存在向 approved 的非人工路径（禁用后须人工 enable，S3-10）', () => {
    // 通向 approved 的合法动作只有 approve(来自 pending) 与 enable(来自 disabled)，无自动恢复
    const toApproved = (Object.keys(TRANSITIONS) as McpTransitionAction[]).filter((a) => TRANSITIONS[a].to === 'approved')
    expect(toApproved.sort()).toEqual(['approve', 'enable'])
  })
})
