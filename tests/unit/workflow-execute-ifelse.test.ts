/**
 * 4.4.8a · 执行引擎条件分支（if-else）
 * 验证：按条件命中的分支路由；未命中分支节点不执行；elif/else 顺序；线性图不受影响。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai', () => ({ chat: vi.fn(async () => 'LLM') }))
vi.mock('@/lib/kb/rag', () => ({ retrieveSegments: vi.fn(async () => []) }))

import { executeGraph } from '@/lib/workflow/execute'

const n = (id: string, type: string, config?: Record<string, unknown>) => ({ id, type, data: { config } })
const e = (source: string, target: string, sourceHandle?: string) => ({ source, target, sourceHandle })

// if-else 配置：单条件组、单条件（对节点输入求值）
const ifCfg = (operator: string, value: string) => ({
  cases: [
    {
      id: 'c1',
      caseId: 'if-true',
      logicalOperator: 'and',
      conditions: [{ id: 'g1', logicalOperator: 'and', conditions: [{ id: 'x', operator, value }] }],
    },
  ],
})

// start → if-else →(if-true) TRUE分支 →(else) ELSE分支，两分支各自 template 打标后汇入 end
function branchGraph(cfg: Record<string, unknown>) {
  return {
    nodes: [
      n('s', 'start'),
      n('ie', 'if-else', cfg),
      n('t', 'template-transform', { template: 'TRUE:{{input}}' }),
      n('f', 'template-transform', { template: 'ELSE:{{input}}' }),
      n('end', 'end'),
    ],
    edges: [
      e('s', 'ie'),
      e('ie', 't', 'if-true'),
      e('ie', 'f', 'else'),
      e('t', 'end'),
      e('f', 'end'),
    ],
  }
}

describe('executeGraph · if-else 条件分支（4.4.8a）', () => {
  it('条件命中 → 走 if-true 分支，else 分支节点不执行', async () => {
    const r = await executeGraph(branchGraph(ifCfg('contains', 'foo')), 'hello foo world')
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('TRUE:hello foo world')
    const ids = r.traces.map((t) => t.nodeId)
    expect(ids).toContain('t') // TRUE 分支执行
    expect(ids).not.toContain('f') // ELSE 分支未走到→不记 trace
  })

  it('条件不命中 → 走 else 分支', async () => {
    const r = await executeGraph(branchGraph(ifCfg('contains', 'foo')), 'nothing here')
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('ELSE:nothing here')
    const ids = r.traces.map((t) => t.nodeId)
    expect(ids).toContain('f')
    expect(ids).not.toContain('t')
  })

  it('数值比较运算符（> 走 if-true）', async () => {
    const r = await executeGraph(branchGraph(ifCfg('>', '10')), '42')
    expect(r.output).toBe('TRUE:42')
  })

  it('elif 命中：if-true 不中、elif-1 中', async () => {
    const cfg = {
      cases: [
        { id: 'a', caseId: 'if-true', logicalOperator: 'and', conditions: [{ id: 'g', logicalOperator: 'and', conditions: [{ id: '1', operator: 'is', value: 'A' }] }] },
        { id: 'b', caseId: 'elif-1', logicalOperator: 'and', conditions: [{ id: 'g', logicalOperator: 'and', conditions: [{ id: '2', operator: 'is', value: 'B' }] }] },
      ],
    }
    const graph = {
      nodes: [n('s', 'start'), n('ie', 'if-else', cfg), n('a', 'template-transform', { template: 'A分支' }), n('b', 'template-transform', { template: 'B分支' }), n('end', 'end')],
      edges: [e('s', 'ie'), e('ie', 'a', 'if-true'), e('ie', 'b', 'elif-1'), e('a', 'end'), e('b', 'end')],
    }
    const r = await executeGraph(graph, 'B')
    expect(r.output).toBe('B分支')
    expect(r.traces.map((t) => t.nodeId)).not.toContain('a')
  })

  it('if-else trace 标注命中分支', async () => {
    const r = await executeGraph(branchGraph(ifCfg('contains', 'foo')), 'foo')
    const ieTrace = r.traces.find((t) => t.nodeId === 'ie')
    expect(ieTrace?.status).toBe('succeeded')
    expect(ieTrace?.output).toBe('分支命中：if-true')
  })

  it('线性图（无 if-else）行为不变：全节点执行', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tt', 'template-transform', { template: '[{{input}}]' }), n('end', 'end')], edges: [e('s', 'tt'), e('tt', 'end')] },
      'X',
    )
    expect(r.status).toBe('succeeded')
    expect(r.output).toBe('[X]')
    expect(r.traces.length).toBe(3)
  })
})
