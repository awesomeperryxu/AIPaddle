import { describe, it, expect } from 'vitest'
import { graphToReactFlow, reactFlowToGraph, type PersistedGraph } from '@/lib/workflow/graph-adapter'

// W1-a：图结构适配层（持久化 data.config ↔ React Flow 平铺 node.data）round-trip 保真。

describe('workflow graph adapter', () => {
  const persisted: PersistedGraph = {
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: '开始', config: {} } },
      { id: 'llm-1', type: 'llm', position: { x: 0, y: 120 }, data: { label: 'LLM', description: '处理', config: { model: 'qwen-plus', prompt: '你好 {{input}}' } } },
      { id: 'end-1', type: 'end', position: { x: 0, y: 240 }, data: { label: '结束', config: {} } },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'llm-1' },
      { id: 'e2', source: 'llm-1', target: 'end-1' },
    ],
  }

  it('graphToReactFlow：config 平铺进 data、type 归一为 workflowNode', () => {
    const { nodes, edges } = graphToReactFlow(persisted)
    expect(nodes).toHaveLength(3)
    const llm = nodes.find((n) => n.id === 'llm-1')!
    expect(llm.type).toBe('workflowNode')
    expect(llm.data.blockType).toBe('llm')
    expect(llm.data.label).toBe('LLM')
    expect(llm.data.model).toBe('qwen-plus') // config 平铺
    expect(llm.data.prompt).toBe('你好 {{input}}')
    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({ source: 'start-1', target: 'llm-1', animated: true })
  })

  it('reactFlowToGraph：平铺字段收回 config、blockType 还原 type', () => {
    const rf = graphToReactFlow(persisted)
    const back = reactFlowToGraph(rf.nodes, rf.edges)
    const llm = back.nodes.find((n) => n.id === 'llm-1')!
    expect(llm.type).toBe('llm')
    expect(llm.data?.label).toBe('LLM')
    expect(llm.data?.config).toMatchObject({ model: 'qwen-plus', prompt: '你好 {{input}}' })
    // blockType/label/description 不应残留在 config 里
    expect(llm.data?.config).not.toHaveProperty('blockType')
    expect(llm.data?.config).not.toHaveProperty('label')
  })

  it('round-trip 保持节点/边数量与连接关系', () => {
    const rf = graphToReactFlow(persisted)
    const back = reactFlowToGraph(rf.nodes, rf.edges)
    expect(back.nodes.map((n) => n.type).sort()).toEqual(['end', 'llm', 'start'])
    expect(back.edges).toEqual([
      { id: 'e1', source: 'start-1', target: 'llm-1' },
      { id: 'e2', source: 'llm-1', target: 'end-1' },
    ])
  })

  it('空图/缺字段安全兜底', () => {
    expect(graphToReactFlow(null)).toEqual({ nodes: [], edges: [] })
    expect(graphToReactFlow({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
    const { nodes } = graphToReactFlow({ nodes: [{ id: 'x', type: 'start' }], edges: [] })
    expect(nodes[0].position).toEqual({ x: 250, y: 50 }) // 缺 position 用默认
    expect(nodes[0].data.label).toBe('start') // 缺 label 回退 type
  })
})
