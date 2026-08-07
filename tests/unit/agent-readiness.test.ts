/**
 * L2 测试 · Agent 配置完整度判定（纯函数）
 *
 * 这套判定的存在意义：外部平台导入的 Agent 只有提示词、没有能力接线，
 * 一度 133 个里 89 个是空壳且全部 published。判定口径必须钉死，
 * 否则列表徽标、编排页提示、体检脚本三处会各说各话。
 */
import { describe, it, expect } from 'vitest'
import { assessAgentReadiness, type AgentReadinessInput } from '@/lib/agents/readiness'

const base: AgentReadinessInput = {
  hasSystemPrompt: true, hasModel: true,
  knowledgeBaseCount: 0, skillCount: 0, toolCount: 0, mcpCount: 0, subAgentCount: 0,
}
const codes = (i: Partial<AgentReadinessInput>) =>
  assessAgentReadiness({ ...base, ...i }).gaps.map((g) => g.code)

describe('空壳判定', () => {
  it('无模型且无任何能力 → 空壳', () => {
    expect(assessAgentReadiness({ ...base, hasModel: false }).isShell).toBe(true)
  })

  // 只缺其一不算空壳，否则会误伤两类正常配置
  it('有模型但无能力 → 不是空壳（纯提示词型 Agent 合法）', () => {
    expect(assessAgentReadiness(base).isShell).toBe(false)
  })
  it('无模型但挂了能力 → 不是空壳（模型可回落租户默认）', () => {
    expect(assessAgentReadiness({ ...base, hasModel: false, knowledgeBaseCount: 1 }).isShell).toBe(false)
  })

  it.each([
    ['知识库', { knowledgeBaseCount: 1 }],
    ['Skill', { skillCount: 1 }],
    ['Tool', { toolCount: 1 }],
    ['MCP', { mcpCount: 1 }],
    ['子 Agent', { subAgentCount: 1 }],
  ])('挂载 %s 即视为具备能力', (_l, over) => {
    expect(codes(over)).not.toContain('ability')
  })
})

describe('缺口识别', () => {
  it('缺提示词 → blocking', () => {
    const r = assessAgentReadiness({ ...base, hasSystemPrompt: false })
    expect(r.gaps.find((g) => g.code === 'system-prompt')!.severity).toBe('blocking')
    expect(r.publishable).toBe(false)
  })

  // 模型可回落租户默认，不该拦住发布——只提醒行为不受控
  it('缺模型 → 仅 warning，不拦发布', () => {
    const r = assessAgentReadiness({ ...base, hasModel: false, toolCount: 1 })
    expect(r.gaps.find((g) => g.code === 'model')!.severity).toBe('warning')
    expect(r.publishable).toBe(true)
  })

  it('挂载未发布 Skill → blocking 且点名是哪个', () => {
    const r = assessAgentReadiness({ ...base, skillCount: 1, unpublishedSkillNames: ['订单查询'] })
    const g = r.gaps.find((x) => x.code === 'unpublished-dep')!
    expect(g.severity).toBe('blocking')
    expect(g.hint).toContain('订单查询')
    expect(r.publishable).toBe(false)
  })

  it('配置完整 → 无缺口、可发布', () => {
    const r = assessAgentReadiness({ ...base, knowledgeBaseCount: 2, toolCount: 1 })
    expect(r.gaps).toHaveLength(0)
    expect(r.publishable).toBe(true)
  })
})

describe('提示文案', () => {
  // 只说「缺 X」没有行动价值，必须告诉用户去哪补
  it('每条缺口都带可执行的 hint', () => {
    const r = assessAgentReadiness({
      hasSystemPrompt: false, hasModel: false,
      knowledgeBaseCount: 0, skillCount: 0, toolCount: 0, mcpCount: 0, subAgentCount: 0,
    })
    expect(r.gaps).toHaveLength(3)
    for (const g of r.gaps) {
      expect(g.hint.length).toBeGreaterThan(10)
      expect(g.label).toBeTruthy()
    }
  })
})
