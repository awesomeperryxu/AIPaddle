/**
 * L1 单测 · Skill 类型的「读全集 / 写子集」分离（V12-3.4 / V12-3.5 / AC-04）
 *
 * 核心设计：一个枚举不能同时承担两件事。
 *   · SKILL_TYPES（全集，含 Workflow）—— 用于**读取存量**。
 *     生产库现有 2 条 Workflow 型 Skill（1 条已发布），从枚举里删掉会让它们读出来就报错。
 *   · CREATABLE_SKILL_TYPES（子集，不含 Workflow）—— 用于**新建与 AI 生成**。
 *     新数据不该再产生违规类型。
 *
 * 合成一个枚举的话，必然要么读不出旧数据、要么继续制造新的违规数据。
 */
import { describe, it, expect } from 'vitest'
import {
  SKILL_TYPES, CREATABLE_SKILL_TYPES,
  isSkillType, isCreatableSkillType,
} from '@/lib/skills/status'
import { SkillDraftSchema } from '@/lib/skills/copilot'

describe('读全集 SKILL_TYPES', () => {
  it('仍含 Workflow —— 存量读得出来', () => {
    expect([...SKILL_TYPES]).toContain('Workflow')
    expect(isSkillType('Workflow')).toBe(true)
  })

  it('五类齐全', () => {
    expect([...SKILL_TYPES]).toEqual(['MCP', 'API', 'DB', 'Workflow', 'Prompt'])
  })
})

describe('写子集 CREATABLE_SKILL_TYPES', () => {
  it('🔴 不含 Workflow —— 新建不得再产生（D-05）', () => {
    expect([...CREATABLE_SKILL_TYPES]).not.toContain('Workflow')
    expect(isCreatableSkillType('Workflow')).toBe(false)
  })

  it('其余四类可写', () => {
    for (const t of ['MCP', 'API', 'DB', 'Prompt']) {
      expect(isCreatableSkillType(t), `${t} 应可写`).toBe(true)
    }
  })

  it('🔴 大小写变体也不放过', () => {
    for (const v of ['workflow', 'WORKFLOW', 'WorkFlow']) {
      expect(isCreatableSkillType(v), `${v} 应被拒`).toBe(false)
    }
  })

  it('写子集必须是读全集的真子集（防有人往写子集里加新类型却漏了读全集）', () => {
    for (const t of CREATABLE_SKILL_TYPES) {
      expect([...SKILL_TYPES], `${t} 不在读全集中`).toContain(t)
    }
    expect(CREATABLE_SKILL_TYPES.length).toBeLessThan(SKILL_TYPES.length)
  })
})

describe('Copilot 生成 Schema —— 硬防线', () => {
  it('🔴 模型产出 type=Workflow 时 Schema 校验失败', () => {
    // 提示词只是引导，模型完全可能不听话；Schema 才是真正拦得住的那道
    const r = SkillDraftSchema.safeParse({ name: '流程编排', type: 'Workflow' })
    expect(r.success).toBe(false)
  })

  it('合法类型通过', () => {
    for (const t of ['MCP', 'API', 'DB', 'Prompt']) {
      const r = SkillDraftSchema.safeParse({ name: 'x', type: t })
      expect(r.success, `${t} 应通过`).toBe(true)
    }
  })

  it('未知类型被拒', () => {
    expect(SkillDraftSchema.safeParse({ name: 'x', type: 'Agent' }).success).toBe(false)
    expect(SkillDraftSchema.safeParse({ name: 'x', type: '' }).success).toBe(false)
  })
})
