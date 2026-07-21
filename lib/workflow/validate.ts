// Workflow 图结构校验（ROADMAP 4.4.1 · 验收 S4-02）。
// 纯函数、无副作用、不依赖运行时，供 API 保存/发布前调用 + 单元测试直接覆盖。
// 结构化输入，避免耦合 components/workflow 的完整类型。

export type GraphNode = { id: string; type: string; title?: string }
export type GraphEdge = { source: string; target: string }
export type WorkflowGraph = { nodes: GraphNode[]; edges: GraphEdge[] }

export type ValidationErrorCode =
  | 'no_start'
  | 'no_end'
  | 'orphan_node'
  | 'cycle'
  | 'dangling_edge'

export type ValidationError = {
  code: ValidationErrorCode
  message: string
  /** 定位到问题节点（S4-02 要求可定位）；无关节点时为空 */
  nodeIds: string[]
}

// 开始/结束节点类型（对齐 components/workflow/types/node-types.ts 的 BlockEnum 值）。
// Answer 为 Chatflow 的结束节点，等价于 End。
const START_TYPES = new Set(['start'])
const END_TYPES = new Set(['end', 'answer'])

/**
 * 校验工作流图结构。返回错误数组（空数组 = 合法）。
 * 覆盖：缺开始/结束节点、孤立节点、成环、连线指向不存在节点。
 */
export function validateGraph(graph: WorkflowGraph): ValidationError[] {
  const errors: ValidationError[] = []
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const ids = new Set(nodes.map((n) => n.id))

  // 1. 连线指向不存在的节点（数据完整性，先查，避免后续遍历踩空）
  const dangling = edges.filter((e) => !ids.has(e.source) || !ids.has(e.target))
  if (dangling.length > 0) {
    const bad = [...new Set(dangling.flatMap((e) => [e.source, e.target].filter((x) => !ids.has(x))))]
    errors.push({ code: 'dangling_edge', message: '连线指向不存在的节点', nodeIds: bad })
  }

  // 2. 缺少开始节点
  if (!nodes.some((n) => START_TYPES.has(n.type))) {
    errors.push({ code: 'no_start', message: '缺少开始节点', nodeIds: [] })
  }

  // 3. 缺少结束节点（End 或 Answer）
  if (!nodes.some((n) => END_TYPES.has(n.type))) {
    errors.push({ code: 'no_end', message: '缺少结束节点', nodeIds: [] })
  }

  // 4. 孤立节点：多节点图中，某节点既无入边也无出边（未被任何连线触及）
  if (nodes.length > 1) {
    const touched = new Set<string>()
    for (const e of edges) {
      if (ids.has(e.source)) touched.add(e.source)
      if (ids.has(e.target)) touched.add(e.target)
    }
    const orphans = nodes.filter((n) => !touched.has(n.id)).map((n) => n.id)
    if (orphans.length > 0) {
      errors.push({ code: 'orphan_node', message: '存在未连接节点', nodeIds: orphans })
    }
  }

  // 5. 成环（含自环）：有向图 DFS 三色法找回边
  const cycle = findCycle(nodes, edges, ids)
  if (cycle.length > 0) {
    errors.push({ code: 'cycle', message: '不允许循环连接', nodeIds: cycle })
  }

  return errors
}

/** DFS 三色法找出一个环上的节点；无环返回 []。只统计两端都存在的边。 */
function findCycle(nodes: GraphNode[], edges: GraphEdge[], ids: Set<string>): string[] {
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target)) adj.get(e.source)!.push(e.target)
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>(nodes.map((n) => [n.id, WHITE]))
  const stack: string[] = []

  function dfs(u: string): string[] {
    color.set(u, GRAY)
    stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        // 找到回边 → 提取环上节点（栈中 v..u 段）
        const from = stack.indexOf(v)
        return stack.slice(from)
      }
      if (color.get(v) === WHITE) {
        const found = dfs(v)
        if (found.length > 0) return found
      }
    }
    stack.pop()
    color.set(u, BLACK)
    return []
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE) {
      const found = dfs(n.id)
      if (found.length > 0) return [...new Set(found)]
    }
  }
  return []
}

/** 便捷断言：图是否合法。 */
export function isValidGraph(graph: WorkflowGraph): boolean {
  return validateGraph(graph).length === 0
}
