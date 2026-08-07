// 工作流图结构适配层（W1-a）：持久化格式 ↔ React Flow 画布格式，纯函数、前后端可共用。
//
// 持久化格式（后端 workflows.graph / 执行引擎 / 校验器约定）：
//   node = { id, type: <blockType 如 'start'|'llm'|'end'>, position, data: { label, description, config } }
//   edge = { id, source, target }
// React Flow 画布格式（components/workflow/workflow-page.tsx）：
//   node = { id, type: 'workflowNode', position, data: { blockType, label, description, ...config 平铺 } }
//   edge = { id, source, target, animated }
//
// 关键差异：配置面板把节点配置**平铺**写在 node.data（如 node.data.model / node.data.prompts），
// 而持久化/执行引擎按 node.data.config 读取——本层负责在保存/加载时互转。

export type PersistedNode = {
  id: string
  type: string
  position?: { x: number; y: number }
  data?: { label?: string; description?: string; config?: Record<string, unknown> }
}
// sourceHandle：多出口节点（如 if-else 的 if-true/elif-N/else 分支）的出口标识，
// 决定这条边属于哪个分支。执行引擎据此做条件路由（4.4.8a）。单出口节点为空。
export type PersistedEdge = { id?: string; source: string; target: string; sourceHandle?: string }

// 定时设置（WF-2b）：**与流程内容解耦**——「什么时候跑」是工作流的运行属性，
// 不是流程图里的一步，所以它落在图的元数据上、不占画布节点。
// 编辑器入口在 header「运行 ▾ → 定时设置」，画布只画业务流程。
export type WorkflowSchedule = { enabled: boolean; cron: string; timezone: string }
export type PersistedGraph = { nodes: PersistedNode[]; edges: PersistedEdge[]; schedule?: WorkflowSchedule }

// React Flow 侧的松散形状（与 reactflow 的 Node/Edge 结构兼容，避免耦合其泛型）。
export type RFNodeLike = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
export type RFEdgeLike = { id: string; source: string; target: string; sourceHandle?: string | null; animated?: boolean }

const DEFAULT_POS = { x: 250, y: 50 }

/** 持久化图 → React Flow 画布节点/边。config 平铺进 data 供配置面板读取。 */
export function graphToReactFlow(graph: PersistedGraph | null | undefined): { nodes: RFNodeLike[]; edges: RFEdgeLike[] } {
  const gn = Array.isArray(graph?.nodes) ? graph!.nodes : []
  const ge = Array.isArray(graph?.edges) ? graph!.edges : []
  const nodes: RFNodeLike[] = gn.map((n) => ({
    id: String(n.id),
    type: 'workflowNode',
    position: n.position ?? { ...DEFAULT_POS },
    data: {
      blockType: n.type,
      label: n.data?.label ?? n.type,
      description: n.data?.description,
      ...(n.data?.config ?? {}),
    },
  }))
  const edges: RFEdgeLike[] = ge.map((e) => ({
    id: String(e.id ?? `${e.source}-${e.target}`),
    source: String(e.source),
    target: String(e.target),
    ...(e.sourceHandle ? { sourceHandle: String(e.sourceHandle) } : {}),
    animated: true,
  }))
  return { nodes, edges }
}

/**
 * React Flow 画布节点/边 → 持久化图。把 data 里除 blockType/label/description 外的字段收进 config。
 *
 * 🔴 schedule 必须由调用方传回：它不在画布上（与流程解耦），
 * 每次自动保存都是从画布重建整张图，不显式带上就会被这次保存悄悄抹掉。
 */
export function reactFlowToGraph(nodes: RFNodeLike[], edges: RFEdgeLike[], schedule?: WorkflowSchedule): PersistedGraph {
  return {
    ...(schedule ? { schedule } : {}),
    nodes: nodes.map((n) => {
      const data = (n.data ?? {}) as Record<string, unknown>
      const { blockType, label, description, ...config } = data
      return {
        id: n.id,
        type: String(blockType ?? n.type ?? ''),
        position: n.position,
        data: {
          label: typeof label === 'string' ? label : undefined,
          description: typeof description === 'string' ? description : undefined,
          config,
        },
      }
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: String(e.sourceHandle) } : {}),
    })),
  }
}
