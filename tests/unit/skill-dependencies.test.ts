/**
 * L1 单测 · Skill 依赖的校验闸门（V12-3.2 / V12-3.3 / AC-04）
 *
 * D-05「Skill 禁止依赖 Workflow」有三道防线：
 *   DB 的 CHECK（最硬）→ 本层 assertDepObjectType → 前端选择器
 * 这里锁住第二道。第一道由迁移的 CHECK 保证（已在 apply 时事务内验证），
 * 第三道是体验层，不算数。
 */
import { describe, it, expect } from 'vitest'
import { assertDepObjectType, SkillDepError, DEP_OBJECT_TYPES } from '@/lib/data/skill-dependencies'

describe('assertDepObjectType —— D-05 的服务端防线', () => {
  it('三类合法对象通过', () => {
    for (const t of DEP_OBJECT_TYPES) expect(assertDepObjectType(t)).toBe(t)
  })

  it('🔴 workflow 被拒', () => {
    expect(() => assertDepObjectType('workflow')).toThrow(SkillDepError)
    expect(() => assertDepObjectType('workflow')).toThrow(/D-05/)
  })

  it('🔴 大小写变体同样被拒（Workflow / WORKFLOW / WorkFlow）', () => {
    for (const v of ['Workflow', 'WORKFLOW', 'WorkFlow', 'workFLOW']) {
      expect(() => assertDepObjectType(v), `应拒绝 ${v}`).toThrow(/D-05/)
    }
  })

  it('错误信息说清「为什么不行」与「该怎么做」，不只是说不允许', () => {
    let msg = ''
    try { assertDepObjectType('workflow') } catch (e) { msg = (e as Error).message }
    // 说明职责差异
    expect(msg).toMatch(/方法|职责/)
    // 给出替代路径——否则用户只会想办法绕过
    expect(msg).toMatch(/在 Workflow 里引用/)
  })

  it('未知类型与非字符串被拒', () => {
    for (const v of ['skill', 'agent', 'kb', '', null, undefined, 123, {}, []]) {
      expect(() => assertDepObjectType(v), `应拒绝 ${JSON.stringify(v)}`).toThrow(SkillDepError)
    }
  })

  it('DEP_OBJECT_TYPES 不含 workflow（防将来有人顺手加进白名单）', () => {
    expect([...DEP_OBJECT_TYPES]).not.toContain('workflow')
    expect([...DEP_OBJECT_TYPES]).toEqual(['tool', 'provider', 'connector'])
  })
})
