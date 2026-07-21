import { describe, it, expect, vi, beforeEach } from 'vitest'

const { chat } = vi.hoisted(() => ({ chat: vi.fn() }))
vi.mock('@/lib/ai', () => ({ chat }))

import { classifyIntent, INTENT_ROUTE } from '@/lib/assistant/intent'

describe('意图分类（切片2）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('识别创建 workflow 并提取描述', async () => {
    chat.mockResolvedValue('{"kind":"create-workflow","description":"处理请假审批的工作流"}')
    const r = await classifyIntent('帮我建一个处理请假审批的工作流')
    expect(r.kind).toBe('create-workflow')
    expect(r.description).toContain('请假')
    expect(INTENT_ROUTE['create-workflow']).toBe('/workflows')
  })

  it('识别创建 agent / skill / chatflow 路由正确', async () => {
    chat.mockResolvedValue('{"kind":"create-agent","description":"客服数字员工"}')
    expect((await classifyIntent('做一个客服数字员工')).kind).toBe('create-agent')
    expect(INTENT_ROUTE['create-agent']).toBe('/agents-admin')
    expect(INTENT_ROUTE['create-skill']).toBe('/skill-hub')
    expect(INTENT_ROUTE['create-chatflow']).toBe('/workflows')
  })

  it('普通提问归为 chat', async () => {
    chat.mockResolvedValue('{"kind":"chat","description":""}')
    expect((await classifyIntent('公司的年假政策是什么')).kind).toBe('chat')
  })

  it('模型返回非法 JSON → 回退 chat', async () => {
    chat.mockResolvedValue('这不是JSON')
    expect((await classifyIntent('随便说点什么')).kind).toBe('chat')
  })

  it('空输入 → chat，不调模型', async () => {
    expect((await classifyIntent('   ')).kind).toBe('chat')
    expect(chat).not.toHaveBeenCalled()
  })
})
