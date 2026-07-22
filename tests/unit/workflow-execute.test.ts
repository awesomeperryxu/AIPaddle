import { describe, it, expect, vi } from 'vitest'

// mock lib/ai 的 chat（不打真实 Qwen）——LLM 节点返回可预期内容
vi.mock('@/lib/ai', () => ({
  chat: vi.fn(async (msgs: { content: string }[]) => `LLM回复[输入长度=${msgs[0].content.length}]`),
}))

import { executeGraph } from '@/lib/workflow/execute'

const n = (id: string, type: string, config?: Record<string, unknown>) => ({ id, type, data: { config } })
const e = (source: string, target: string) => ({ source, target })

describe('executeGraph（4.4.3 最小执行引擎）', () => {
  it('start→llm→end 串行执行成功，返回每节点 trace', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('l', 'llm'), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
      '你好',
    )
    expect(r.status).toBe('succeeded')
    expect(r.traces.map((x) => x.nodeId)).toEqual(['s', 'l', 't'])
    expect(r.traces.every((x) => x.status === 'succeeded')).toBe(true)
    // 最终输出 = end 节点输出 = llm 输出透传
    expect(r.output).toContain('LLM回复')
  })

  it('非法图（无 end）→ failed', async () => {
    const r = await executeGraph({ nodes: [n('s', 'start'), n('l', 'llm')], edges: [e('s', 'l')] }, 'x')
    expect(r.status).toBe('failed')
  })

  it('Tool 等不支持节点 → skipped 并透传', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tool', 'tool'), n('t', 'end')], edges: [e('s', 'tool'), e('tool', 't')] },
      'passthrough',
    )
    expect(r.status).toBe('succeeded')
    const toolTrace = r.traces.find((x) => x.nodeId === 'tool')
    expect(toolTrace?.status).toBe('skipped')
    expect(r.output).toBe('passthrough') // 透传到 end
  })

  it('LLM 节点用 config.prompt 模板（{{input}} 占位）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('l', 'llm', { prompt: '翻译：{{input}}' }), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
      'hello',
    )
    // chat 被调用，输入长度 = '翻译：hello'.length = 8
    expect(r.output).toContain('输入长度=8')
  })

  // 4.4.8 slice 1：模板转换 + 参数提取器
  it('模板转换节点：{{input}} 替换为节点输入（不调 LLM）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tt', 'template-transform', { template: '结果=[{{input}}]' }), n('t', 'end')], edges: [e('s', 'tt'), e('tt', 't')] },
      'ABC',
    )
    expect(r.status).toBe('succeeded')
    const tr = r.traces.find((x) => x.nodeId === 'tt')
    expect(tr?.status).toBe('succeeded')
    expect(r.output).toBe('结果=[ABC]')
  })

  it('模板转换：空模板透传输入', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tt', 'template-transform', {}), n('t', 'end')], edges: [e('s', 'tt'), e('tt', 't')] },
      'passthru',
    )
    expect(r.output).toBe('passthru')
  })

  it('参数提取器节点：调 LLM 提取（succeeded）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('pe', 'parameter-extractor', { parameters: [{ name: 'city' }] }), n('t', 'end')], edges: [e('s', 'pe'), e('pe', 't')] },
      '北京天气',
    )
    expect(r.status).toBe('succeeded')
    const tr = r.traces.find((x) => x.nodeId === 'pe')
    expect(tr?.status).toBe('succeeded')
    expect(r.output).toContain('LLM回复') // mock chat 被调用
  })
})
