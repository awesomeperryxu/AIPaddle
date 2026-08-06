// 工作流图自动布局（WF-4）：给没有坐标的节点算出「从左到右分层」的位置。
//
// 🔴 为什么必须有这一层：Copilot 产出的节点只有 id/type/label，没有 position，
// `graph-adapter.ts` 于是把每个节点都落到同一个 DEFAULT_POS——用户看到的是
// 六个节点**完全重叠**堆在一起，手动拖开后位置与流程顺序毫无关系。
//
// 算法：最长路径分层（longest-path layering）+ 层内重心排序（barycenter），
// 纯函数、零依赖、可单测。不引 dagre/elk——这里的图只有十几个节点，
// 引一个 60KB 的布局库不划算，且它们的输出还得再映射回 React Flow 坐标系。

/** 画布节点尺寸（与 workflow-page.tsx 里 WorkflowNode 的 width/minHeight 一致） */
export const NODE_WIDTH = 240
export const NODE_HEIGHT = 88

/** 层间距（含节点宽）与层内行距（含节点高） */
export const COLUMN_STEP = NODE_WIDTH + 120 // 360
export const ROW_STEP = NODE_HEIGHT + 72 // 160

/** 画布左上留白 */
export const ORIGIN = { x: 80, y: 80 }

export type LayoutNode = { id: string; type?: string }
export type LayoutEdge = { source: string; target: string }
export type Position = { x: number; y: number }

const ENTRY_PREFIX = 'trigger'
const isEntryType = (type?: string) => type === 'start' || (!!type && type.startsWith(ENTRY_PREFIX))

/**
 * 计算每个节点的画布坐标。返回 id → {x, y}。
 *
 * - 有环时不会死循环：环上节点挂到已定层前驱之后（图校验本应拦下环，这里只做兜底）
 * - 孤立节点不会与他人重叠：按自身层内顺序照常排行
 */
export function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Record<string, Position> {
  const ids = nodes.map((n) => n.id)
  if (ids.length === 0) return {}
  const idSet = new Set(ids)

  // 只保留两端都存在、且非自环的边
  const validEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target)

  const outAdj = new Map<string, string[]>(ids.map((id) => [id, []]))
  const inAdj = new Map<string, string[]>(ids.map((id) => [id, []]))
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const e of validEdges) {
    outAdj.get(e.source)!.push(e.target)
    inAdj.get(e.target)!.push(e.source)
    indeg.set(e.target, indeg.get(e.target)! + 1)
  }

  // ① 最长路径分层：layer(v) = max(layer(u) + 1)，u 为 v 的所有前驱
  const layer = new Map<string, number>(ids.map((id) => [id, 0]))
  const remaining = new Map(indeg)
  const queue = ids.filter((id) => remaining.get(id) === 0)
  const settled = new Set(queue)
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi]
    for (const v of outAdj.get(u)!) {
      layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + 1))
      remaining.set(v, remaining.get(v)! - 1)
      if (remaining.get(v) === 0 && !settled.has(v)) {
        settled.add(v)
        queue.push(v)
      }
    }
  }
  // 环上节点（永远出不了队）：挂到已定层前驱的下一层，保证不与前驱重叠
  for (const id of ids) {
    if (settled.has(id)) continue
    const parents = inAdj.get(id)!.filter((p) => settled.has(p))
    layer.set(id, parents.length ? Math.max(...parents.map((p) => layer.get(p)!)) + 1 : 0)
  }

  // 入口节点强制留在第 0 层——即便模型给它连了入边（如误把 end 连回 start）
  for (const n of nodes) {
    if (isEntryType(n.type) && (inAdj.get(n.id)?.length ?? 0) === 0) layer.set(n.id, 0)
  }

  // ② 分桶：同层节点按输入顺序初始化
  const maxLayer = Math.max(...ids.map((id) => layer.get(id)!))
  const buckets: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const id of ids) buckets[layer.get(id)!].push(id)

  // ③ 层内重心排序：按前驱在上一层的平均行号排，减少连线交叉。
  //    两轮足够——节点数量级在十几个，再多轮收益极小。
  const rowOf = new Map<string, number>()
  const syncRows = () => buckets.forEach((b) => b.forEach((id, i) => rowOf.set(id, i)))
  syncRows()
  for (let pass = 0; pass < 2; pass++) {
    for (let li = 1; li < buckets.length; li++) {
      const bucket = buckets[li]
      const bary = new Map<string, number>()
      bucket.forEach((id, i) => {
        const parents = inAdj.get(id)!.filter((p) => layer.get(p)! < li)
        const avg = parents.length
          ? parents.reduce((s, p) => s + (rowOf.get(p) ?? 0), 0) / parents.length
          : i // 没有上层前驱：保持原位，不参与重排
        bary.set(id, avg)
      })
      // 稳定排序：重心相同的保持原有先后（分支的 IF/ELSE 顺序不会被打乱）
      bucket
        .map((id, i) => ({ id, i }))
        .sort((a, b) => bary.get(a.id)! - bary.get(b.id)! || a.i - b.i)
        .forEach((x, i) => { bucket[i] = x.id })
      syncRows()
    }
  }

  // ④ 落坐标：每层竖直居中对齐到最宽层的中线，视觉上是一条主干
  const tallest = Math.max(...buckets.map((b) => b.length))
  const centerY = ORIGIN.y + ((tallest - 1) / 2) * ROW_STEP
  const positions: Record<string, Position> = {}
  buckets.forEach((bucket, li) => {
    const offset = centerY - ((bucket.length - 1) / 2) * ROW_STEP
    bucket.forEach((id, ri) => {
      positions[id] = { x: ORIGIN.x + li * COLUMN_STEP, y: offset + ri * ROW_STEP }
    })
  })
  return positions
}
