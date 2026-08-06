/**
 * L2 测试 · WF-3 Copilot 生成 Tool 节点（纯函数部分）
 *
 * 背景：白名单原本只有 start/llm/end/if-else，「查找全网 AI 事件」这类需求
 * 只能生成一个 llm 节点**假装在检索**——看着完整，跑起来是模型编的。
 *
 * 🔴 核心安全边界：模型会编造 tool_id。只靠 prompt 说「禁止编造」拦不住，
 *    放任不管会生成一条引用不存在 Skill、永远校验不过的流程，比不生成更糟。
 */
import { describe, it, expect } from 'vitest'
import { sanitizeToolNodes } from '@/lib/workflow/copilot'

const allowed = new Set(['sk-real-1', 'sk-real-2'])
const toolNode = (id: string, toolId: string, label = '联网检索') => ({
  id, type: 'tool', label, config: { tool_id: toolId },
})

describe('编造的 tool_id 必须被降级', () => {
  it('引用不存在的 Skill → 降级为 llm 并标注需人工挂载', () => {
    const g = sanitizeToolNodes(
      { nodes: [toolNode('t1', 'sk-hallucinated')], edges: [] },
      allowed,
    )
    const n = g.nodes[0]
    expect(n.type).toBe('llm')
    expect(n.label).toContain('需接入能力')
  })

  it('tool_id 为空 → 同样降级', () => {
    const g = sanitizeToolNodes({ nodes: [toolNode('t1', '')], edges: [] }, allowed)
    expect(g.nodes[0].type).toBe('llm')
  })

  // 降级而非丢弃：节点 id 与连线必须保留，否则流程结构会塌
  it('降级保留节点 id，连线不受影响', () => {
    const g = sanitizeToolNodes(
      {
        nodes: [
          { id: 'start_1', type: 'start', label: '开始' },
          toolNode('t1', 'sk-fake'),
          { id: 'end_1', type: 'end', label: '结束' },
        ],
        edges: [{ source: 'start_1', target: 't1' }, { source: 't1', target: 'end_1' }],
      },
      allowed,
    )
    expect(g.nodes.map((n) => n.id)).toEqual(['start_1', 't1', 'end_1'])
    expect(g.edges).toHaveLength(2)
  })
})

describe('合法引用原样保留', () => {
  it('tool_id 在清单内 → 保持 tool 类型与 config', () => {
    const g = sanitizeToolNodes({ nodes: [toolNode('t1', 'sk-real-1')], edges: [] }, allowed)
    const n = g.nodes[0]
    expect(n.type).toBe('tool')
    expect(n.config?.tool_id).toBe('sk-real-1')
  })

  it('非 tool 节点一律不动', () => {
    const nodes = [
      { id: 's', type: 'start', label: '开始' },
      { id: 'l', type: 'llm', label: '处理' },
      { id: 'i', type: 'if-else', label: '判断' },
      { id: 'e', type: 'end', label: '结束' },
    ]
    const g = sanitizeToolNodes({ nodes, edges: [] }, allowed)
    expect(g.nodes).toEqual(nodes)
  })
})

describe('无可用 Skill 时', () => {
  // 工作区一个已发布 Skill 都没有 → 所有 tool 节点都该降级，
  // 否则用户拿到的是一条注定校验不过的流程
  it('清单为空 → 全部 tool 节点降级', () => {
    const g = sanitizeToolNodes(
      { nodes: [toolNode('t1', 'sk-real-1'), toolNode('t2', 'sk-real-2')], edges: [] },
      new Set<string>(),
    )
    expect(g.nodes.every((n) => n.type === 'llm')).toBe(true)
  })
})
