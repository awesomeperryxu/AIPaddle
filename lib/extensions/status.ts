import type { Action } from '@/lib/auth/permissions'

/**
 * Extension 生命周期状态机（V12-8.4 / ADR-020）。
 *
 * 与 Agent 的状态机（lib/agents/status.ts）同构——刻意保持一致，
 * 让「非法流转回 409、动作驱动而非目标态驱动」这套语义在全项目只有一种写法。
 *
 * 🔴 与 Agent 的关键差异：published 意味着**外部系统可以调用**。
 * 因此 offline 不只是「不可见」，而是**外部调用立即拒绝**——下线要能真正断流。
 */
export type ExtensionStatus = 'draft' | 'pending' | 'published' | 'offline'
export type ExtTransitionAction = 'submit' | 'approve' | 'reject' | 'offline' | 'online'

export const EXT_TRANSITIONS: Record<
  ExtTransitionAction,
  { from: ExtensionStatus; to: ExtensionStatus; action: Action }
> = {
  submit: { from: 'draft', to: 'pending', action: 'ext:update' },
  approve: { from: 'pending', to: 'published', action: 'ext:publish' },
  reject: { from: 'pending', to: 'draft', action: 'ext:publish' },
  offline: { from: 'published', to: 'offline', action: 'ext:publish' },
  online: { from: 'offline', to: 'published', action: 'ext:publish' },
}

/** 某状态下所有合法动作（供前端按当前状态渲染可用操作）。 */
export function extActionsFor(status: ExtensionStatus): ExtTransitionAction[] {
  return (Object.keys(EXT_TRANSITIONS) as ExtTransitionAction[])
    .filter((a) => EXT_TRANSITIONS[a].from === status)
}

export const EXT_ACTION_LABEL: Record<ExtTransitionAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  offline: '下线',
  online: '重新上线',
}

/** 仅 published 的 Extension 可被外部调用。其余一律拒绝。 */
export function isCallable(status: ExtensionStatus): boolean {
  return status === 'published'
}
