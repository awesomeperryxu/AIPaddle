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

// 风险分级发布策略（S3-04）：提交时低风险自动通过直接发布，中/高风险须过安全审核。
// 纯函数，供 submit 逻辑与单元测试共用。
export type SkillRisk = 'low' | 'medium' | 'high'
export function submitTargetForRisk(risk: SkillRisk): 'published' | 'pending' {
  return risk === 'low' ? 'published' : 'pending'
}

// Skill 五类型（S3-01，对齐 DB CHECK 与 my_mcp_servers 封装）。
//
// ⚠️ 这是**读取存量**用的全集，含历史遗留的 'Workflow'。
// 生产库现有 2 条 Workflow 型 Skill（1 条已发布），故不能直接从枚举里删——
// 删了会让这 2 条读出来就报错。它们由 V12-3.7 迁移处理。
export const SKILL_TYPES = ['MCP', 'API', 'DB', 'Workflow', 'Prompt'] as const
export type SkillType = (typeof SKILL_TYPES)[number]
export function isSkillType(v: unknown): v is SkillType {
  return typeof v === 'string' && (SKILL_TYPES as readonly string[]).includes(v)
}

/**
 * 🔴 V12-3.5 / D-05：**新建或 AI 生成** Skill 时可选的类型，不含 'Workflow'。
 *
 * 为什么要和 SKILL_TYPES 分开：
 *   · SKILL_TYPES 是「能读出来的全集」——存量有 Workflow 型，删了读不出来；
 *   · 本常量是「能写进去的子集」——新数据不该再产生 Workflow 型。
 * 一个枚举同时承担这两件事，必然要么读不出旧数据、要么继续产生新的违规数据。
 *
 * D-05 的立意：Skill 是「怎么做这件事」的方法，Workflow 是「多步怎么编排」的流程。
 * 把 Workflow 做成一种 Skill，等于让 Skill 承担编排职责，二者职责就糊了。
 */
export const CREATABLE_SKILL_TYPES = ['MCP', 'API', 'DB', 'Prompt'] as const
export type CreatableSkillType = (typeof CREATABLE_SKILL_TYPES)[number]
export function isCreatableSkillType(v: unknown): v is CreatableSkillType {
  return typeof v === 'string' && (CREATABLE_SKILL_TYPES as readonly string[]).includes(v)
}
