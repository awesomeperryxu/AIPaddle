// 工作流图结构校验（4.4.1）。纯函数，无副作用，前后端可共用。
// 规则：① 必须有开始/触发节点 ② 必须有结束节点 ③ 无孤立节点 ④ 无环路。

export type GraphNode = { id: string; type: string }
export type GraphEdge = { id?: string; source: string; target: string }
export type WorkflowGraph = { nodes: GraphNode[]; edges: GraphEdge[] }
export type GraphError = { code: string; message: string; nodeId?: string }

function isEntry(type: string): boolean {
  return type === 'start' || type.startsWith('trigger')
}

export function validateGraph(graph: WorkflowGraph): GraphError[] {
  const errors: GraphError[] = []
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph?.edges) ? graph.edges : []

  if (nodes.length === 0) {
    return [{ code: 'empty', message: '工作流为空：至少需要一个开始节点和一个结束节点' }]
  }

  // ① 开始/触发节点
  if (!nodes.some((n) => isEntry(n.type))) {
    errors.push({ code: 'no_start', message: '缺少开始/触发节点' })
  }
  // ② 结束节点
  if (!nodes.some((n) => n.type === 'end')) {
    errors.push({ code: 'no_end', message: '缺少结束节点' })
  }

  const ids = new Set(nodes.map((n) => n.id))
  // 边引用的节点必须存在
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      errors.push({ code: 'dangling_edge', message: `连线引用了不存在的节点（${e.source} → ${e.target}）` })
    }
  }

  // ③ 孤立节点（无任何连线）——多于一个节点时才判
  if (nodes.length > 1) {
    const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]))
    for (const e of edges) {
      if (degree.has(e.source)) degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
      if (degree.has(e.target)) degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    }
    for (const n of nodes) {
      if ((degree.get(n.id) ?? 0) === 0) {
        errors.push({ code: 'isolated', message: `存在孤立节点（${n.id}），未连接到流程`, nodeId: n.id })
      }
    }
  }

  // ④ 环路检测（DFS 三色）
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (adj.has(e.source) && ids.has(e.target)) adj.get(e.source)!.push(e.target)
  }
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]))
  let cycle = false
  const visit = (start: string) => {
    // 迭代式 DFS，避免大图递归爆栈
    const stack: { id: string; idx: number }[] = [{ id: start, idx: 0 }]
    color.set(start, GRAY)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const nbrs = adj.get(top.id) ?? []
      if (top.idx < nbrs.length) {
        const v = nbrs[top.idx++]
        const c = color.get(v)
        if (c === GRAY) { cycle = true; return }
        if (c === WHITE) { color.set(v, GRAY); stack.push({ id: v, idx: 0 }) }
      } else {
        color.set(top.id, BLACK)
        stack.pop()
      }
    }
  }
  for (const n of nodes) {
    if (color.get(n.id) === WHITE) { visit(n.id); if (cycle) break }
  }
  if (cycle) errors.push({ code: 'cycle', message: '工作流存在环路，不允许（会导致无限循环）' })

  return errors
}
