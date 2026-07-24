/**
 * ADR-012 P1 · 变量节点执行器（variable-assigner / variable-aggregator / list-operator）
 * 观察手法：assigner 写入 pool.vars 后，用下游 aggregator 读回 {{var}} 输出 JSON 以断言。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai', () => ({ chat: vi.fn(async () => 'LLM') }))
vi.mock('@/lib/kb/rag', () => ({ retrieveSegments: vi.fn(async () => []) }))

import { executeGraph } from '@/lib/workflow/execute'

const n = (id: string, type: string, config?: Record<string, unknown>) => ({ id, type, data: { config } })
const e = (source: string, target: string) => ({ source, target })

// 单源聚合器：读 {{name}} → 输出 JSON 数组
const aggOf = (ref: string) => n('agg', 'variable-aggregator', {
  sources: [{ id: 's1', variable: `{{${ref}}}` }],
  outputVariable: 'agg',
  outputType: 'array',
})

// start → assigner → aggregator(读回) → end
function assignGraph(assignments: Record<string, unknown>[], readVar: string) {
  return {
    nodes: [n('s', 'start'), n('va', 'variable-assigner', { assignments }), aggOf(readVar), n('t', 'end')],
    edges: [e('s', 'va'), e('va', 'agg'), e('agg', 't')],
  }
}

// start → list-operator → end
function listGraph(cfg: Record<string, unknown>) {
  return {
    nodes: [n('s', 'start'), n('lo', 'list-operator', cfg), n('t', 'end')],
    edges: [e('s', 'lo'), e('lo', 't')],
  }
}

describe('variable-assigner', () => {
  it('set：字面量赋值', async () => {
    const r = await executeGraph(
      assignGraph([{ targetVariable: 'g', targetType: 'string', sourceExpression: 'hi', operation: 'set' }], 'g'),
      'x',
    )
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('["hi"]')
  })

  it('increment：先 set 10 再 +5 = 15', async () => {
    const r = await executeGraph(
      assignGraph(
        [
          { targetVariable: 'c', targetType: 'number', sourceExpression: '10', operation: 'set' },
          { targetVariable: 'c', targetType: 'number', sourceExpression: '5', operation: 'increment' },
        ],
        'c',
      ),
      'x',
    )
    expect(r.output).toBe('[15]')
  })

  it('append：数组 push 元素', async () => {
    const r = await executeGraph(
      assignGraph(
        [
          { targetVariable: 'l', targetType: 'array', sourceExpression: '[]', operation: 'set' },
          { targetVariable: 'l', targetType: 'array', sourceExpression: 'x', operation: 'append' },
        ],
        'l',
      ),
      'x',
    )
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('[["x"]]') // 聚合器把数组变量收进外层数组
  })

  it('toggle：false → true', async () => {
    const r = await executeGraph(
      assignGraph(
        [
          { targetVariable: 'f', targetType: 'boolean', sourceExpression: 'false', operation: 'set' },
          { targetVariable: 'f', targetType: 'boolean', sourceExpression: '', operation: 'toggle' },
        ],
        'f',
      ),
      'x',
    )
    expect(r.output).toBe('[true]')
  })
})

describe('variable-aggregator', () => {
  it('合并多个变量为数组', async () => {
    const graph = {
      nodes: [
        n('s', 'start'),
        n('va', 'variable-assigner', {
          assignments: [
            { targetVariable: 'a', targetType: 'string', sourceExpression: '1', operation: 'set' },
            { targetVariable: 'b', targetType: 'string', sourceExpression: '2', operation: 'set' },
          ],
        }),
        n('agg', 'variable-aggregator', {
          sources: [{ id: 's1', variable: '{{a}}' }, { id: 's2', variable: '{{b}}' }],
          outputVariable: 'merged',
          outputType: 'array',
        }),
        n('t', 'end'),
      ],
      edges: [e('s', 'va'), e('va', 'agg'), e('agg', 't')],
    }
    const r = await executeGraph(graph, 'x')
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('["1","2"]')
  })
})

describe('list-operator', () => {
  it('sort：升序排序', async () => {
    const r = await executeGraph(listGraph({ operation: 'sort', sortOrder: 'asc' }), '[3,1,2]')
    expect(r.output).toBe('[1,2,3]')
  })

  it('slice：按起止索引截取', async () => {
    const r = await executeGraph(listGraph({ operation: 'slice', sliceStart: 1, sliceEnd: 3 }), '[10,20,30,40]')
    expect(r.output).toBe('[20,30]')
  })

  it('reverse：反转', async () => {
    const r = await executeGraph(listGraph({ operation: 'reverse' }), '[1,2,3]')
    expect(r.output).toBe('[3,2,1]')
  })

  it('unique：去重', async () => {
    const r = await executeGraph(listGraph({ operation: 'unique' }), '[1,1,2,3,3]')
    expect(r.output).toBe('[1,2,3]')
  })

  it('filter：需表达式引擎 → 透传 + trace 标注（status 仍 succeeded）', async () => {
    const r = await executeGraph(listGraph({ operation: 'filter', expression: 'item > 1' }), '[1,2,3]')
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('[1,2,3]') // 透传
    const tr = r.traces.find((x) => x.nodeId === 'lo')
    expect(tr?.status).toBe('succeeded')
    expect(tr?.error).toContain('暂不支持')
  })
})

describe('跨节点串联', () => {
  it('assigner 写 {{sys.query}} → aggregator 读回', async () => {
    const r = await executeGraph(
      assignGraph([{ targetVariable: 'q', targetType: 'string', sourceExpression: '{{ sys.query }}', operation: 'set' }], 'q'),
      'PING',
    )
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('["PING"]')
  })
})
