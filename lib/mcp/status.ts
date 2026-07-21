import type { Action } from '@/lib/auth/permissions'

// MCP Server 注册审批状态机（4.3.0）。DB CHECK: draft/pending/approved/disabled。
// 唯一合法流转在 TRANSITIONS 中登记；表外一律非法（API 返回 409）。
// S3-10：禁用（approved→disabled）后引用它的 Skill 立即不可用，恢复须人工 enable（无自动恢复）。
export type McpStatus = 'draft' | 'pending' | 'approved' | 'disabled'
export type McpTransitionAction = 'submit' | 'approve' | 'reject' | 'disable' | 'enable'

export const TRANSITIONS: Record<
  McpTransitionAction,
  { from: McpStatus; to: McpStatus; action: Action }
> = {
  submit: { from: 'draft', to: 'pending', action: 'mcp:submit' }, // 注册者提交审核
  approve: { from: 'pending', to: 'approved', action: 'mcp:review' }, // 审核通过 → 可被 Skill 引用
  reject: { from: 'pending', to: 'draft', action: 'mcp:review' }, // 驳回
  disable: { from: 'approved', to: 'disabled', action: 'mcp:review' }, // 禁用（联动禁用引用它的 Skill）
  enable: { from: 'disabled', to: 'approved', action: 'mcp:review' }, // 人工重新启用（S3-10：无自动恢复）
}

// 某状态下所有合法动作（供前端按当前状态渲染可用操作）
export function actionsFor(status: McpStatus): McpTransitionAction[] {
  return (Object.keys(TRANSITIONS) as McpTransitionAction[]).filter((a) => TRANSITIONS[a].from === status)
}

export const ACTION_LABEL: Record<McpTransitionAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  disable: '禁用',
  enable: '重新启用',
}
