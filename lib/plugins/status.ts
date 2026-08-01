import type { Action } from '@/lib/auth/permissions'

/**
 * Plugin / Tool 生命周期状态机（V12-2.8 / PRD v1.13 §14）。
 *
 * 与 Agent（lib/agents/status.ts）、Extension（lib/extensions/status.ts）**刻意同构**——
 * 全项目只有一种状态机写法：动作驱动（不是目标态驱动）、非法流转回 409、
 * 用 from 态作为 update 条件以关掉并发窗口。
 *
 * 🔴 Plugin 与 Tool 共用同一套流转：二者的发布语义相同（发布 = 允许被上层资产依赖），
 * 分成两套只会让"某个动作在 Plugin 叫 approve 在 Tool 叫 publish"这类不一致悄悄长出来。
 */
export type PluginStatus = 'draft' | 'pending' | 'published' | 'offline'
export type PluginTransitionAction = 'submit' | 'approve' | 'reject' | 'offline' | 'online'

/** Plugin 的流转与所需权限 */
export const PLUGIN_TRANSITIONS: Record<
  PluginTransitionAction,
  { from: PluginStatus; to: PluginStatus; action: Action }
> = {
  submit: { from: 'draft', to: 'pending', action: 'plugin:update' },
  approve: { from: 'pending', to: 'published', action: 'plugin:review' },
  reject: { from: 'pending', to: 'draft', action: 'plugin:review' },
  offline: { from: 'published', to: 'offline', action: 'plugin:review' },
  online: { from: 'offline', to: 'published', action: 'plugin:review' },
}

/** Tool 的流转（结构同上，权限走 tool:*） */
export const TOOL_TRANSITIONS: Record<
  PluginTransitionAction,
  { from: PluginStatus; to: PluginStatus; action: Action }
> = {
  submit: { from: 'draft', to: 'pending', action: 'tool:update' },
  approve: { from: 'pending', to: 'published', action: 'tool:review' },
  reject: { from: 'pending', to: 'draft', action: 'tool:review' },
  offline: { from: 'published', to: 'offline', action: 'tool:review' },
  online: { from: 'offline', to: 'published', action: 'tool:review' },
}

export function pluginActionsFor(status: PluginStatus): PluginTransitionAction[] {
  return (Object.keys(PLUGIN_TRANSITIONS) as PluginTransitionAction[])
    .filter((a) => PLUGIN_TRANSITIONS[a].from === status)
}

export const PLUGIN_ACTION_LABEL: Record<PluginTransitionAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  offline: '下线',
  online: '重新上线',
}

/**
 * 只有 published 的 Tool 可被上层资产（Skill/Agent/Workflow）依赖与调用。
 *
 * 🔴 下线要真正阻断新运行（AC-17），不只是"列表里看不见"——
 * 一个被下线的 Tool 若仍能被已发布的 Skill 调用，下线就等于没做。
 */
export function isUsable(status: PluginStatus): boolean {
  return status === 'published'
}
