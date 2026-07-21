/**
 * L2 单元测试 · lib/workflow/validate.ts（ROADMAP 4.4.1 · 验收 S4-02）
 * 覆盖：合法图、缺开始/结束、孤立节点、成环（含自环）、悬空连线。
 */
import { describe, it, expect } from 'vitest'
import { validateGraph, isValidGraph, type WorkflowGraph } from '@/lib/workflow/validate'

const startEnd: WorkflowGraph = {
  nodes: [
    { id: 's', type: 'start' },
    { id: 'l', type: 'llm' },
    { id: 'e', type: 'end' },
  ],
  edges: [
    { source: 's', target: 'l' },
    { source: 'l', target: 'e' },
  ],
}

describe('validateGraph', () => {
  it('合法的 start→llm→end 三节点流通过', () => {
    expect(validateGraph(startEnd)).toEqual([])
    expect(isValidGraph(startEnd)).toBe(true)
  })

  it('Answer 作为结束节点也算有结束（Chatflow）', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'answer' }],
      edges: [{ source: 's', target: 'a' }],
    }
    expect(validateGraph(g)).toEqual([])
  })

  it('缺少开始节点 → no_start', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 'l', type: 'llm' }, { id: 'e', type: 'end' }],
      edges: [{ source: 'l', target: 'e' }],
    }
    const errs = validateGraph(g)
    expect(errs.map((e) => e.code)).toContain('no_start')
    expect(errs.find((e) => e.code === 'no_start')!.message).toBe('缺少开始节点')
  })

  it('缺少结束节点 → no_end', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 's', type: 'start' }, { id: 'l', type: 'llm' }],
      edges: [{ source: 's', target: 'l' }],
    }
    expect(validateGraph(g).map((e) => e.code)).toContain('no_end')
  })

  it('孤立节点 → orphan_node，且定位到该节点', () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'orphan', type: 'llm' },
        { id: 'e', type: 'end' },
      ],
      edges: [{ source: 's', target: 'e' }],
    }
    const err = validateGraph(g).find((e) => e.code === 'orphan_node')!
    expect(err.message).toBe('存在未连接节点')
    expect(err.nodeIds).toContain('orphan')
  })

  it('自环 → cycle', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 's', type: 'start' }, { id: 'l', type: 'llm' }, { id: 'e', type: 'end' }],
      edges: [
        { source: 's', target: 'l' },
        { source: 'l', target: 'l' },
        { source: 'l', target: 'e' },
      ],
    }
    const err = validateGraph(g).find((e) => e.code === 'cycle')!
    expect(err.message).toBe('不允许循环连接')
    expect(err.nodeIds).toContain('l')
  })

  it('多节点成环 → cycle，环上节点被定位', () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a', type: 'llm' },
        { id: 'b', type: 'llm' },
        { id: 'e', type: 'end' },
      ],
      edges: [
        { source: 's', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' }, // a↔b 成环
        { source: 'b', target: 'e' },
      ],
    }
    const err = validateGraph(g).find((e) => e.code === 'cycle')!
    expect(err.nodeIds).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('连线指向不存在节点 → dangling_edge', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }],
      edges: [{ source: 's', target: 'ghost' }],
    }
    const err = validateGraph(g).find((e) => e.code === 'dangling_edge')!
    expect(err.nodeIds).toContain('ghost')
  })

  it('空图 → 缺开始+缺结束', () => {
    const codes = validateGraph({ nodes: [], edges: [] }).map((e) => e.code)
    expect(codes).toContain('no_start')
    expect(codes).toContain('no_end')
  })
})
