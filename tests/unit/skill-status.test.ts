/**
 * L2 单元测试 · lib/skills/status.ts（ROADMAP 4.3.1 · 验收 S3-01/S3-02）
 */
import { describe, it, expect } from 'vitest'
import {
  TRANSITIONS,
  actionsFor,
  ACTION_LABEL,
  isSkillType,
  SKILL_TYPES,
  type SkillTransitionAction,
} from '@/lib/skills/status'

describe('Skill 状态机（S3-02）', () => {
  it('审核主链 draft→pending→published 登记正确', () => {
    expect(TRANSITIONS.submit).toMatchObject({ from: 'draft', to: 'pending', action: 'skill:submit' })
    expect(TRANSITIONS.approve).toMatchObject({ from: 'pending', to: 'published', action: 'skill:review' })
    expect(TRANSITIONS.reject).toMatchObject({ from: 'pending', to: 'draft', action: 'skill:review' })
  })

  it('actionsFor 按状态给出可用动作', () => {
    expect(actionsFor('draft')).toEqual(['submit'])
    expect(actionsFor('pending').sort()).toEqual(['approve', 'reject'])
    expect(actionsFor('published')).toEqual([]) // 已发布无后续流转（首版）
  })

  it('发布者不能自审自发：submit 与 approve 是不同权限', () => {
    expect(TRANSITIONS.submit.action).not.toBe(TRANSITIONS.approve.action)
  })

  it('每个动作都有中文标签', () => {
    for (const a of Object.keys(TRANSITIONS) as SkillTransitionAction[]) {
      expect(ACTION_LABEL[a]).toBeTruthy()
    }
  })
})

describe('Skill 类型校验（S3-01）', () => {
  it('五类型全部有效', () => {
    expect([...SKILL_TYPES]).toEqual(['MCP', 'API', 'DB', 'Workflow', 'Prompt'])
    for (const t of SKILL_TYPES) expect(isSkillType(t)).toBe(true)
  })
  it('非法类型被拒', () => {
    expect(isSkillType('code')).toBe(false)
    expect(isSkillType('')).toBe(false)
    expect(isSkillType(123)).toBe(false)
    expect(isSkillType(undefined)).toBe(false)
  })
})
