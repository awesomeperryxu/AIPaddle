import { describe, it, expect } from 'vitest'
import { AgentConfigSchema, AgentVariableSchema } from '@/lib/agents/config'

// 4.1.7：Agent 编排配置 Zod 校验。

describe('AgentConfigSchema', () => {
  it('接受合法配置', () => {
    const r = AgentConfigSchema.safeParse({
      systemPrompt: '你是客服助手',
      model: 'qwen-plus',
      temperature: 0.7,
      agentMode: 'react',
      maxIterations: 5,
      variables: [{ key: 'company', type: 'string', required: true }],
    })
    expect(r.success).toBe(true)
  })

  it('温度越界被拒', () => {
    expect(AgentConfigSchema.safeParse({ temperature: 3 }).success).toBe(false)
    expect(AgentConfigSchema.safeParse({ temperature: -1 }).success).toBe(false)
  })

  it('最大迭代越界/非整数被拒', () => {
    expect(AgentConfigSchema.safeParse({ maxIterations: 0 }).success).toBe(false)
    expect(AgentConfigSchema.safeParse({ maxIterations: 21 }).success).toBe(false)
    expect(AgentConfigSchema.safeParse({ maxIterations: 1.5 }).success).toBe(false)
  })

  it('非法 agentMode 被拒', () => {
    expect(AgentConfigSchema.safeParse({ agentMode: 'auto' }).success).toBe(false)
  })

  it('partial 允许空对象（PATCH 部分更新）', () => {
    expect(AgentConfigSchema.partial().safeParse({}).success).toBe(true)
  })

  it('变量名必填、type 默认 string', () => {
    expect(AgentVariableSchema.safeParse({ key: '' }).success).toBe(false)
    const ok = AgentVariableSchema.safeParse({ key: 'x' })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.type).toBe('string')
  })

  // 4.1.9 大脑字段
  it('接受大脑配置：workflow 绑定', () => {
    expect(AgentConfigSchema.safeParse({ brainMode: 'workflow', brainWorkflowId: '456d60b5-8d64-445a-b9d1-4d9c30e9ae92' }).success).toBe(true)
  })

  it('接受大脑配置：routing 规则', () => {
    expect(AgentConfigSchema.safeParse({ brainMode: 'routing', routingRules: [{ keyword: '报销', skillId: 's1' }] }).success).toBe(true)
  })

  it('非法 brainMode / 非 uuid 的 brainWorkflowId 被拒', () => {
    expect(AgentConfigSchema.safeParse({ brainMode: 'auto' }).success).toBe(false)
    expect(AgentConfigSchema.safeParse({ brainWorkflowId: 'not-a-uuid' }).success).toBe(false)
  })

  it('brainWorkflowId 允许 null（清除绑定）', () => {
    expect(AgentConfigSchema.safeParse({ brainWorkflowId: null }).success).toBe(true)
  })

  // 4.1.12 Features
  it('接受 Features 配置', () => {
    expect(AgentConfigSchema.safeParse({
      openingStatement: '你好，我是客服助手',
      suggestedQuestions: ['如何退货', '订单查询'],
      citationEnabled: true,
      moderationEnabled: false,
    }).success).toBe(true)
  })

  it('建议问题超过 10 条被拒', () => {
    expect(AgentConfigSchema.safeParse({ suggestedQuestions: Array(11).fill('q') }).success).toBe(false)
  })
})
