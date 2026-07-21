import type { Action } from '@/lib/auth/permissions'

// Skill 生命周期状态机（4.3.1，S3-02）。与 Agent 同构：草稿 → 待审核 → 已发布。
// 统一上架审核流（ADR-007）：创建者 submit，Admin/Auditor review，发布者不能自审自发。
// DB CHECK: draft/pending/published。表外流转一律非法（API 409）。
export type SkillStatus = 'draft' | 'pending' | 'published'
export type SkillTransitionAction = 'submit' | 'approve' | 'reject'

export const TRANSITIONS: Record<
  SkillTransitionAction,
  { from: SkillStatus; to: SkillStatus; action: Action }
> = {
  submit: { from: 'draft', to: 'pending', action: 'skill:submit' }, // 提交审核
  approve: { from: 'pending', to: 'published', action: 'skill:review' }, // 审核通过
  reject: { from: 'pending', to: 'draft', action: 'skill:review' }, // 驳回
}

export function actionsFor(status: SkillStatus): SkillTransitionAction[] {
  return (Object.keys(TRANSITIONS) as SkillTransitionAction[]).filter((a) => TRANSITIONS[a].from === status)
}

export const ACTION_LABEL: Record<SkillTransitionAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
}

// Skill 五类型（S3-01，对齐 DB CHECK 与 my_mcp_servers 封装）
export const SKILL_TYPES = ['MCP', 'API', 'DB', 'Workflow', 'Prompt'] as const
export type SkillType = (typeof SKILL_TYPES)[number]
export function isSkillType(v: unknown): v is SkillType {
  return typeof v === 'string' && (SKILL_TYPES as readonly string[]).includes(v)
}
