/**
 * L1 单测 · Agent 名称校验（S1-CRUD-02）
 *
 * 背景：创建与改名此前**都不校验名称**——空名、超长名直接落库，编排页顶栏
 * 把名字清空后自动保存照样成功，列表里就多一张无名卡片。e2e 早写了断言，
 * 但被「列表是卡片不是 table」的定位问题掩盖，一直混在「测试挂了」里。
 *
 * 抽成共用函数的原因：创建（POST /api/agents）与改名（PATCH）两条路径规则必须一致，
 * 各写一份必然漂移（此前 POST 只挡空名、PATCH 两样都不挡）。
 * 放 lib/agents/name.ts 而非数据层：数据层带 server-only 且在路由测试里被整体
 * vi.mock，校验若放进去，AgentValidationError 会变 undefined 让 instanceof 抛错。
 */
import { describe, it, expect } from 'vitest'
import { assertAgentName, AgentValidationError, AGENT_NAME_MAX } from '@/lib/agents/name'

describe('assertAgentName', () => {
  it('正常名称原样通过并去除首尾空白', () => {
    expect(assertAgentName('  合同审查员  ')).toBe('合同审查员')
  })

  it('恰好等于长度上限 → 通过（边界不能误杀）', () => {
    const name = 'A'.repeat(AGENT_NAME_MAX)
    expect(assertAgentName(name)).toBe(name)
  })

  it('🔴 空字符串 → 抛「名称不能为空」', () => {
    expect(() => assertAgentName('')).toThrow(AgentValidationError)
    expect(() => assertAgentName('')).toThrow(/名称不能为空/)
  })

  it('🔴 纯空白 → 同样视为空（trim 后判定，防止用空格绕过）', () => {
    expect(() => assertAgentName('   \t \n ')).toThrow(/名称不能为空/)
  })

  it('🔴 超过上限一个字符 → 抛「名称过长」', () => {
    expect(() => assertAgentName('A'.repeat(AGENT_NAME_MAX + 1))).toThrow(/名称过长/)
  })

  it('首尾空白不计入长度（trim 后再判长）', () => {
    const name = ` ${'A'.repeat(AGENT_NAME_MAX)} `
    expect(assertAgentName(name)).toHaveLength(AGENT_NAME_MAX)
  })
})
