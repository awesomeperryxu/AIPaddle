// 画布撤销/重做历史栈（WF-4）。纯函数、不依赖 React，便于单测。
//
// 此前 workflow-page 把 canUndo/canRedo 写死 false、也没传 onUndo/onRedo，
// 撤销与重做两个按钮永远是禁用状态——功能从未存在过，不是坏了。

/** 一份画布快照。泛型是为了不把 ReactFlow 的类型拖进纯函数层 */
export type Snapshot<N, E> = { nodes: N[]; edges: E[] }

export type History<N, E> = {
  past: Snapshot<N, E>[]
  present: Snapshot<N, E>
  future: Snapshot<N, E>[]
}

/** 上限。太大占内存，太小撤不回去；50 步覆盖绝大多数编辑场景 */
export const HISTORY_LIMIT = 50

export function initHistory<N, E>(present: Snapshot<N, E>): History<N, E> {
  return { past: [], present, future: [] }
}

/**
 * 提交一次新状态。
 * 🔴 新操作会清空 future——这是撤销栈的标准语义：撤销几步后又做了新编辑，
 * 原来的「重做」分支就不该还能走回去，否则会拼出一条用户从未编辑过的历史。
 */
export function pushHistory<N, E>(h: History<N, E>, next: Snapshot<N, E>): History<N, E> {
  const past = [...h.past, h.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
  }
}

export function canUndo<N, E>(h: History<N, E>): boolean {
  return h.past.length > 0
}
export function canRedo<N, E>(h: History<N, E>): boolean {
  return h.future.length > 0
}

/** 撤销。无可撤销时原样返回，调用方不必先判断 */
export function undo<N, E>(h: History<N, E>): History<N, E> {
  if (h.past.length === 0) return h
  const previous = h.past[h.past.length - 1]
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
  }
}

/** 重做。无可重做时原样返回 */
export function redo<N, E>(h: History<N, E>): History<N, E> {
  if (h.future.length === 0) return h
  const next = h.future[0]
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
  }
}

/**
 * 判断两份快照是否等价（只比结构，不比坐标）。
 *
 * 拖动节点会持续触发 onNodesChange，若每次位移都进历史栈，撤销一次只挪回几像素，
 * 用户要按几十下才能撤销掉一次真正的编辑。故位置变化不计入历史。
 */
export function isStructurallyEqual<N extends { id: string; type?: string }, E extends { id?: string; source: string; target: string }>(
  a: Snapshot<N, E>,
  b: Snapshot<N, E>,
): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false
  const key = (n: N) => `${n.id}:${n.type ?? ''}`
  const an = a.nodes.map(key).sort().join('|')
  const bn = b.nodes.map(key).sort().join('|')
  if (an !== bn) return false
  const ek = (e: E) => `${e.source}->${e.target}`
  const ae = a.edges.map(ek).sort().join('|')
  const be = b.edges.map(ek).sort().join('|')
  return ae === be
}
