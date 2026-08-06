/**
 * L2 测试 · WF-4 画布撤销/重做历史栈
 *
 * 此前 workflow-page 把 canUndo/canRedo 写死 false、onUndo/onRedo 根本没传，
 * 两个按钮永远禁用——功能从未存在。本模块补上语义，测试锁住三条容易写错的：
 * 新操作清空 future、位置变化不进历史、栈上限。
 */
import { describe, it, expect } from 'vitest'
import {
  initHistory, pushHistory, undo, redo, canUndo, canRedo,
  isStructurallyEqual, HISTORY_LIMIT,
} from '@/lib/workflow/history'

type N = { id: string; type?: string; position?: { x: number; y: number } }
type E = { id?: string; source: string; target: string }

const snap = (ids: string[], edges: [string, string][] = []) => ({
  nodes: ids.map((id) => ({ id })) as N[],
  edges: edges.map(([source, target]) => ({ source, target })) as E[],
})

describe('基本进出栈', () => {
  it('初始状态两个方向都不可用', () => {
    const h = initHistory<N, E>(snap(['a']))
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })

  it('push 后可撤销；撤销后可重做', () => {
    let h = initHistory<N, E>(snap(['a']))
    h = pushHistory(h, snap(['a', 'b']))
    expect(canUndo(h)).toBe(true)

    h = undo(h)
    expect(h.present.nodes.map((n) => n.id)).toEqual(['a'])
    expect(canRedo(h)).toBe(true)

    h = redo(h)
    expect(h.present.nodes.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('空栈上撤销/重做原样返回，不抛错', () => {
    const h = initHistory<N, E>(snap(['a']))
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
})

describe('新操作清空 future', () => {
  // 🔴 撤销栈标准语义：撤销后又做新编辑，原重做分支必须作废，
  // 否则重做会拼出一条用户从未编辑过的历史
  it('撤销后再 push → 不能再重做', () => {
    let h = initHistory<N, E>(snap(['a']))
    h = pushHistory(h, snap(['a', 'b']))
    h = undo(h)
    expect(canRedo(h)).toBe(true)

    h = pushHistory(h, snap(['a', 'c']))
    expect(canRedo(h)).toBe(false)
    expect(h.present.nodes.map((n) => n.id)).toEqual(['a', 'c'])
  })
})

describe('栈上限', () => {
  it(`超过 ${HISTORY_LIMIT} 步后丢弃最旧的，present 不受影响`, () => {
    let h = initHistory<N, E>(snap(['n0']))
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = pushHistory(h, snap([`n${i}`]))
    expect(h.past.length).toBe(HISTORY_LIMIT)
    expect(h.present.nodes[0].id).toBe(`n${HISTORY_LIMIT + 10}`)
  })
})

describe('结构等价判定（位置变化不进历史）', () => {
  // 拖动节点会持续触发 onNodesChange，若每次位移都入栈，
  // 撤销一次只挪回几像素，用户得按几十下才能撤销一次真正的编辑
  it('仅坐标不同 → 视为等价', () => {
    const a = { nodes: [{ id: 'x', position: { x: 0, y: 0 } }] as N[], edges: [] as E[] }
    const b = { nodes: [{ id: 'x', position: { x: 300, y: 120 } }] as N[], edges: [] as E[] }
    expect(isStructurallyEqual(a, b)).toBe(true)
  })

  it.each([
    ['增删节点', snap(['a']), snap(['a', 'b'])],
    ['节点类型变化', { nodes: [{ id: 'a', type: 'llm' }] as N[], edges: [] as E[] }, { nodes: [{ id: 'a', type: 'tool' }] as N[], edges: [] as E[] }],
    ['增删连线', snap(['a', 'b']), snap(['a', 'b'], [['a', 'b']])],
    ['连线端点变化', snap(['a', 'b', 'c'], [['a', 'b']]), snap(['a', 'b', 'c'], [['a', 'c']])],
  ])('%s → 视为不等价', (_l, a, b) => {
    expect(isStructurallyEqual(a, b)).toBe(false)
  })

  it('节点顺序不同但内容相同 → 等价（避免顺序抖动误入历史）', () => {
    expect(isStructurallyEqual(snap(['a', 'b']), snap(['b', 'a']))).toBe(true)
  })
})
