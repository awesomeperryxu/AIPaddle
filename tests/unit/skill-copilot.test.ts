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

// ── #51 P3 多轮对话式建 Skill：定稿提取 / 清洗（纯函数）──────────────
import { extractSkillChatDraft, stripSkillDraftBlock } from '@/lib/skills/copilot'

describe('extractSkillChatDraft（对话定稿提取）', () => {
  it('含合法 skilldraft 块 → 返回校验后的草稿', () => {
    const text = '好的，我为你起草如下：\n```skilldraft\n{"name":"周报转邮件","type":"Prompt","description":"把周报要点整理成邮件","riskLevel":"low","documentation":"# 周报转邮件\\n用途..."}\n```'
    const d = extractSkillChatDraft(text)
    expect(d).toMatchObject({ name: '周报转邮件', type: 'Prompt', riskLevel: 'low' })
    expect(d?.documentation).toContain('周报转邮件')
  })
  it('仍在澄清阶段（无定稿块）→ null', () => {
    expect(extractSkillChatDraft('请问这个 Skill 主要用于什么场景？')).toBeNull()
  })
  it('定稿块 JSON 非法 → null（不抛错）', () => {
    expect(extractSkillChatDraft('```skilldraft\n{坏的 json}\n```')).toBeNull()
  })
  it('类型非法 → schema 拒绝 → null', () => {
    expect(extractSkillChatDraft('```skilldraft\n{"name":"x","type":"code"}\n```')).toBeNull()
  })
})

describe('stripSkillDraftBlock（清洗展示文本）', () => {
  it('去掉 skilldraft 块只留自然语言', () => {
    const out = stripSkillDraftBlock('这是说明。\n```skilldraft\n{"name":"x","type":"Prompt"}\n```')
    expect(out).toBe('这是说明。')
    expect(out).not.toContain('skilldraft')
  })
  it('无定稿块时原样返回（trim）', () => {
    expect(stripSkillDraftBlock('  只是普通回复  ')).toBe('只是普通回复')
  })
})
