import { describe, it, expect, vi } from 'vitest'

const chatMock = vi.fn()
vi.mock('@/lib/ai', () => ({ chat: (...a: unknown[]) => chatMock(...a) }))

import { generateWorkflowGraph } from '@/lib/workflow/copilot'

const validGraphJson = JSON.stringify({
  nodes: [{ id: 's', type: 'start', label: '开始' }, { id: 'l', type: 'llm', label: '处理' }, { id: 'e', type: 'end', label: '结束' }],
  edges: [{ source: 's', target: 'l' }, { source: 'l', target: 'e' }],
})

describe('generateWorkflowGraph（4.4.5 Copilot）', () => {
  it('模型返回合法 JSON 图 → valid', async () => {
    chatMock.mockReset().mockResolvedValueOnce(validGraphJson)
    const r = await generateWorkflowGraph('做一个客服问答流程')
    expect(r.valid).toBe(true)
    expect(r.graph.nodes.map((n) => n.id)).toEqual(['s', 'l', 'e'])
  })

  it('解析被 ```json 代码块包裹的输出', async () => {
    chatMock.mockReset().mockResolvedValueOnce('```json\n' + validGraphJson + '\n```')
    const r = await generateWorkflowGraph('x')
    expect(r.valid).toBe(true)
    expect(r.graph.edges.length).toBe(2)
  })

  it('首次非法（缺 end）→ 触发修复轮 → 第二次合法', async () => {
    const invalid = JSON.stringify({ nodes: [{ id: 's', type: 'start', label: '开始' }, { id: 'l', type: 'llm', label: 'x' }], edges: [{ source: 's', target: 'l' }] })
    chatMock.mockReset().mockResolvedValueOnce(invalid).mockResolvedValueOnce(validGraphJson)
    const r = await generateWorkflowGraph('x')
    expect(chatMock).toHaveBeenCalledTimes(2) // 修复轮触发
    expect(r.valid).toBe(true)
  })

  it('模型输出无法解析 → 返回空图 + 校验错误（不崩）', async () => {
    chatMock.mockReset().mockResolvedValueOnce('抱歉我不会')
    const r = await generateWorkflowGraph('x')
    expect(r.valid).toBe(false)
    expect(r.graph.nodes.length).toBe(0)
  })
})
