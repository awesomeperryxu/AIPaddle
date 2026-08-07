/**
 * L2 测试 · WF-26 answer 节点被静默跳过
 *
 * 🔴 用户实测：流程「运行成功」，但运行详情里最后一步 `answer.answer-1` 显示
 * 「跳过 · 该节点类型需 4.4.2/Skill 支持」——整条流程的**输出节点根本没执行**，
 * 用户拿到的是上一步的原始输出，而他定义的输出格式压根没生效。
 * 这比报错更隐蔽：状态是成功的。
 *
 * 两个成因：① 执行引擎 SUPPORTED 白名单里没有 answer；
 * ② create 端点算出了 workflow/chatflow 类型却没传给 Copilot，
 *    于是给 Workflow 也配了 Chatflow 专用的 answer 收尾。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai', () => ({ chat: async () => 'LLM结果' }))
vi.mock('@/lib/kb/rag', () => ({ retrieveSegments: async () => [] }))
vi.mock('@/lib/data/agents', () => ({ getAgentForChat: async () => null }))
vi.mock('@/lib/workflow/tool-node', () => ({ runToolNode: async () => '' }))

import { executeGraph } from '@/lib/workflow/execute'
import { normalizeGraph } from '@/lib/workflow/copilot'

const node = (id: string, type: string, config: Record<string, unknown> = {}) => ({
  id, type, data: { label: id, config },
})

describe('执行引擎支持 answer', () => {
  const chatflow = {
    nodes: [node('start-1', 'start'), node('llm-1', 'llm', { prompt: '处理' }), node('answer-1', 'answer', { answer: '简报如下：\n{{input}}' })],
    edges: [{ source: 'start-1', target: 'llm-1' }, { source: 'llm-1', target: 'answer-1' }],
  }

  it('不再被标 skipped', async () => {
    const r = await executeGraph(chatflow as never, '输入', {})
    const t = r.traces.find((x) => x.nodeId === 'answer-1')!
    expect(t.status).toBe('succeeded')
  })

  it('回复模板生效，{{input}} 被替换成上游输出', async () => {
    const r = await executeGraph(chatflow as never, '输入', {})
    expect(r.output).toBe('简报如下：\nLLM结果')
  })

  it('没写模板则透传上游输出（等同 end）', async () => {
    const g = {
      nodes: [node('start-1', 'start'), node('llm-1', 'llm', { prompt: 'x' }), node('answer-1', 'answer')],
      edges: [{ source: 'start-1', target: 'llm-1' }, { source: 'llm-1', target: 'answer-1' }],
    }
    const r = await executeGraph(g as never, '输入', {})
    expect(r.output).toBe('LLM结果')
  })
})

describe('Workflow 不该出现 answer', () => {
  const raw = {
    nodes: [{ id: 's', type: 'start', label: '开始' }, { id: 'a', type: 'answer', label: '输出简报' }],
    edges: [{ source: 's', target: 'a' }],
  }

  it('appType=workflow → answer 换成 end', () => {
    const g = normalizeGraph(raw, 'workflow')
    expect(g.nodes.map((n) => n.type)).toEqual(['start', 'end'])
  })

  it('appType=chatflow → 保留 answer', () => {
    const g = normalizeGraph(raw, 'chatflow')
    expect(g.nodes.map((n) => n.type)).toEqual(['start', 'answer'])
  })

  it('默认按 workflow 处理', () => {
    expect(normalizeGraph(raw).nodes.map((n) => n.type)).toEqual(['start', 'end'])
  })

  it('换类型不影响节点标题与连线', () => {
    const g = normalizeGraph(raw, 'workflow')
    expect(g.nodes[1].data?.label).toBe('输出简报')
    expect(g.edges).toHaveLength(1)
  })
})
