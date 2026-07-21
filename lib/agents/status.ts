import type { Action } from '@/lib/auth/permissions'

// Agent 生命周期状态机（4.1.2）。线性主链：草稿 → 待审核 → 已发布 →（下线）已下线。
// 唯一合法流转在 TRANSITIONS 中登记；表外的一律非法（API 返回 409）。
export type AgentStatus = 'draft' | 'pending' | 'published' | 'offline'
export type TransitionAction = 'submit' | 'approve' | 'reject' | 'offline' | 'online'

// action → { 起始态 from, 目标态 to, 所需权限 }
export const TRANSITIONS: Record<TransitionAction, { from: AgentStatus; to: AgentStatus; action: Action }> = {
  submit: { from: 'draft', to: 'pending', action: 'agent:submit' }, // 提交审核
  approve: { from: 'pending', to: 'published', action: 'agent:review' }, // 审核通过
  reject: { from: 'pending', to: 'draft', action: 'agent:review' }, // 驳回
  offline: { from: 'published', to: 'offline', action: 'agent:update' }, // 下线
  online: { from: 'offline', to: 'published', action: 'agent:update' }, // 重新上线
}

// 某状态下所有合法动作（供前端按当前状态渲染可用操作）
export function actionsFor(status: AgentStatus): TransitionAction[] {
  return (Object.keys(TRANSITIONS) as TransitionAction[]).filter(a => TRANSITIONS[a].from === status)
}

// 动作中文名（UI 用）
export const ACTION_LABEL: Record<TransitionAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  offline: '下线',
  online: '重新上线',
}
