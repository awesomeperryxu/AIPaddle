/**
 * L2 测试 · WF-4 工作流图自动布局
 *
 * 背景：Copilot 产出的节点没有 position，graph-adapter 把它们全落到同一个
 * DEFAULT_POS——用户打开编辑器看到六个节点**完全重叠**堆成一坨，
 * 手动拖开后位置与流程顺序毫无关系。布局层就是为了让「打开即可读」。
 */
import { describe, it, expect } from 'vitest'
import { layoutGraph, COLUMN_STEP, ROW_STEP, NODE_WIDTH, NODE_HEIGHT } from '@/lib/workflow/layout'

const n = (id: string, type = 'llm') => ({ id, type })
const e = (source: string, target: string) => ({ source, target })

/** 两个节点的外接矩形是否重叠——重叠即等于用户看到的「堆在一起」 */
function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT
}

describe('线性流程', () => {
  const nodes = [n('s', 'start'), n('l1'), n('l2'), n('e', 'end')]
  const edges = [e('s', 'l1'), e('l1', 'l2'), e('l2', 'e')]

  it('依次向右分列，每列一个节点', () => {
    const pos = layoutGraph(nodes, edges)
    expect(pos.l1.x - pos.s.x).toBe(COLUMN_STEP)
    expect(pos.l2.x - pos.l1.x).toBe(COLUMN_STEP)
    expect(pos.e.x - pos.l2.x).toBe(COLUMN_STEP)
    expect(new Set([pos.s.y, pos.l1.y, pos.l2.y, pos.e.y]).size).toBe(1)
  })

  it('任意两节点都不重叠', () => {
    const pos = layoutGraph(nodes, edges)
    const ids = Object.keys(pos)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(pos[ids[i]], pos[ids[j]])).toBe(false)
      }
    }
  })
})

describe('分支流程', () => {
  // start → if-else →(if) llm-a → end
  //                  →(else) llm-b ↗
  const nodes = [n('s', 'start'), n('c', 'if-else'), n('a'), n('b'), n('e', 'end')]
  const edges = [e('s', 'c'), e('c', 'a'), e('c', 'b'), e('a', 'e'), e('b', 'e')]

  it('两条分支同列不同行，不重叠', () => {
    const pos = layoutGraph(nodes, edges)
    expect(pos.a.x).toBe(pos.b.x)
    expect(Math.abs(pos.a.y - pos.b.y)).toBe(ROW_STEP)
    expect(overlaps(pos.a, pos.b)).toBe(false)
  })

  it('汇合节点排在分支之后一列', () => {
    const pos = layoutGraph(nodes, edges)
    expect(pos.e.x).toBe(pos.a.x + COLUMN_STEP)
  })
})

describe('边界情况', () => {
  it('空图返回空对象', () => {
    expect(layoutGraph([], [])).toEqual({})
  })

  it('孤立节点也有独立坐标，不与他人重叠', () => {
    const pos = layoutGraph([n('s', 'start'), n('e', 'end'), n('orphan')], [e('s', 'e')])
    expect(overlaps(pos.orphan, pos.s)).toBe(false)
  })

  it('悬空边（引用不存在的节点）不影响布局', () => {
    const pos = layoutGraph([n('s', 'start'), n('e', 'end')], [e('s', 'e'), e('s', 'ghost')])
    expect(Object.keys(pos)).toEqual(['s', 'e'])
    expect(pos.e.x - pos.s.x).toBe(COLUMN_STEP)
  })

  // 图校验本应拦下环；布局层兜底不能死循环，否则一条脏图会把生成接口挂住
  it('有环的图不会死循环，所有节点都拿到坐标', () => {
    const pos = layoutGraph([n('a'), n('b'), n('c')], [e('a', 'b'), e('b', 'c'), e('c', 'a')])
    expect(Object.keys(pos).sort()).toEqual(['a', 'b', 'c'])
  })

  it('自环边被忽略', () => {
    const pos = layoutGraph([n('s', 'start'), n('e', 'end')], [e('s', 's'), e('s', 'e')])
    expect(pos.e.x - pos.s.x).toBe(COLUMN_STEP)
  })

  it('定时触发节点即便被误连入边，仍留在第一列', () => {
    const nodes = [n('t', 'trigger-schedule'), n('l'), n('e', 'end')]
    const edges = [e('t', 'l'), e('l', 'e')]
    const pos = layoutGraph(nodes, edges)
    expect(pos.t.x).toBeLessThan(pos.l.x)
  })
})
