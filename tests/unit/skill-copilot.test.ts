/**
 * L2 单元测试 · lib/skills/copilot.ts（ROADMAP 4.3.3）
 * 覆盖 JSON 提取 + CP-03 生成不越权（只能封装 allowed 列表内 Server）。
 */
import { describe, it, expect } from 'vitest'
import { extractJson, validateDraftServer, SkillDraftSchema } from '@/lib/skills/copilot'

describe('extractJson', () => {
  it('容忍 ```json 围栏与前后噪声', () => {
    expect(extractJson('这是结果：\n```json\n{"a":1}\n```\n完成')).toEqual({ a: 1 })
  })
  it('无 JSON → 抛错', () => {
    expect(() => extractJson('没有 json')).toThrow()
  })
})

describe('SkillDraftSchema', () => {
  it('合法草稿通过并补默认', () => {
    const d = SkillDraftSchema.parse({ name: 'x', type: 'API' })
    expect(d).toMatchObject({ name: 'x', type: 'API', riskLevel: 'low', allowedTools: [] })
  })
  it('非法类型被拒', () => {
    expect(() => SkillDraftSchema.parse({ name: 'x', type: 'code' })).toThrow()
  })
})

describe('validateDraftServer（CP-03 生成不越权）', () => {
  const allowed = ['srv-a', 'srv-b']
  it('非 MCP 型直接通过', () => {
    expect(validateDraftServer({ type: 'API', mcpServerId: '' }, allowed)).toEqual({ ok: true })
  })
  it('MCP 型引用 allowed 内 Server → 通过', () => {
    expect(validateDraftServer({ type: 'MCP', mcpServerId: 'srv-a' }, allowed)).toEqual({ ok: true })
  })
  it('MCP 型引用越权 Server → 拒绝', () => {
    const r = validateDraftServer({ type: 'MCP', mcpServerId: 'srv-forbidden' }, allowed)
    expect(r.ok).toBe(false)
  })
  it('MCP 型未指定 Server → 拒绝', () => {
    expect(validateDraftServer({ type: 'MCP', mcpServerId: '' }, allowed).ok).toBe(false)
  })
})
