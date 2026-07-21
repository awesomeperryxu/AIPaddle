import { describe, it, expect } from 'vitest'
import { validateGraph } from '@/lib/workflow/validate'

const n = (id: string, type: string) => ({ id, type })
const e = (source: string, target: string) => ({ source, target })

describe('validateGraph（4.4.1 图结构校验）', () => {
  it('合法线性图：start → llm → end，无错误', () => {
    const errs = validateGraph({
      nodes: [n('s', 'start'), n('a', 'llm'), n('t', 'end')],
      edges: [e('s', 'a'), e('a', 't')],
    })
    expect(errs).toEqual([])
  })

  it('空图 → empty', () => {
    expect(validateGraph({ nodes: [], edges: [] })[0].code).toBe('empty')
  })

  it('缺开始节点 → no_start', () => {
    const codes = validateGraph({ nodes: [n('a', 'llm'), n('t', 'end')], edges: [e('a', 't')] }).map((x) => x.code)
    expect(codes).toContain('no_start')
  })

  it('缺结束节点 → no_end', () => {
    const codes = validateGraph({ nodes: [n('s', 'start'), n('a', 'llm')], edges: [e('s', 'a')] }).map((x) => x.code)
    expect(codes).toContain('no_end')
  })

  it('孤立节点 → isolated', () => {
    const errs = validateGraph({
      nodes: [n('s', 'start'), n('t', 'end'), n('x', 'llm')],
      edges: [e('s', 't')],
    })
    expect(errs.some((x) => x.code === 'isolated' && x.nodeId === 'x')).toBe(true)
  })

  it('环路 → cycle', () => {
    const codes = validateGraph({
      nodes: [n('s', 'start'), n('a', 'llm'), n('b', 'llm'), n('t', 'end')],
      edges: [e('s', 'a'), e('a', 'b'), e('b', 'a'), e('a', 't')],
    }).map((x) => x.code)
    expect(codes).toContain('cycle')
  })

  it('触发节点算开始节点', () => {
    const codes = validateGraph({
      nodes: [n('w', 'trigger-webhook'), n('t', 'end')],
      edges: [e('w', 't')],
    }).map((x) => x.code)
    expect(codes).not.toContain('no_start')
  })

  it('悬空连线 → dangling_edge', () => {
    const codes = validateGraph({
      nodes: [n('s', 'start'), n('t', 'end')],
      edges: [e('s', 'ghost')],
    }).map((x) => x.code)
    expect(codes).toContain('dangling_edge')
  })
})
