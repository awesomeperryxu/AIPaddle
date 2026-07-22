// 工作流 DSL 导入/导出（4.4.12）：自有 DSL（与持久化图同构），可导出为文件、导入重建草稿。
// 兼容 Dify DSL 作为后续增强（映射成本另计）。纯函数，前后端可共用。

type GraphLike = { nodes: unknown[]; edges: unknown[] }

export type DslDoc = {
  aipaddle_dsl: 'v1'
  kind: 'workflow' | 'chatflow'
  name: string
  graph: GraphLike
}

export type ParsedDSL = { name: string; type: 'workflow' | 'chatflow'; graph: GraphLike }

/** 把一个工作流导出为 DSL 文档。 */
export function exportDSL(wf: { name: string; type: 'workflow' | 'chatflow'; graph?: GraphLike | null }): DslDoc {
  const g = wf.graph
  return {
    aipaddle_dsl: 'v1',
    kind: wf.type === 'chatflow' ? 'chatflow' : 'workflow',
    name: wf.name,
    graph: {
      nodes: Array.isArray(g?.nodes) ? g!.nodes : [],
      edges: Array.isArray(g?.edges) ? g!.edges : [],
    },
  }
}

/** 解析 DSL 文档为可创建的工作流数据；结构非法则返回错误。 */
export function parseDSL(raw: unknown): { ok: true; value: ParsedDSL } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'DSL 内容不是有效对象' }
  const d = raw as Record<string, unknown>
  if (d.aipaddle_dsl !== 'v1') return { ok: false, error: '不支持的 DSL 版本（需 aipaddle_dsl="v1"）' }
  const kind: 'workflow' | 'chatflow' = d.kind === 'chatflow' ? 'chatflow' : 'workflow'
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : '导入的工作流'
  const g = d.graph
  if (!g || typeof g !== 'object') return { ok: false, error: 'DSL 缺少 graph 字段' }
  const gg = g as Record<string, unknown>
  if (!Array.isArray(gg.nodes) || !Array.isArray(gg.edges)) {
    return { ok: false, error: 'graph 需同时包含 nodes 与 edges 数组' }
  }
  return { ok: true, value: { name, type: kind, graph: { nodes: gg.nodes, edges: gg.edges } } }
}
