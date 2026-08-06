import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError, type GraphNode } from '@/lib/workflow/validate'

// Workflow Copilot（4.4.5，ADR-005）：自然语言 → 结构化工作流图（draft）。
// 四道防线：① 白名单节点类型 ② 强制 JSON 结构 ③ 图校验 ④ 仅产 draft、AI 不能发布/保存（由用户采纳后走既有 PATCH）。
// 首版仅生成基础节点（start/llm/end/if-else）；Tool/Skill 节点需 4.3.x/C 道，暂不生成。

// WF-3：加入 tool 节点。此前白名单只有 start/llm/end/if-else，
// 于是「查找全网 AI 事件」这类需要外部能力的需求只能生成一个 llm 节点
// **假装在检索**——真跑起来是模型编的，看着完整却不能用。
const ALLOWED_TYPES = ['start', 'llm', 'end', 'if-else', 'tool'] as const

/** 可供 Copilot 选用的 Skill（调用方从数据层取「本租户已发布」的传入） */
export type AvailableSkill = { id: string; name: string; description?: string | null; type?: string | null }

const BASE_RULES = `硬性要求：① 恰好一个 start、至少一个 end；② 每个节点都要连入流程（无孤立节点）；③ 不能有环。`

function buildSystemPrompt(skills: AvailableSkill[]): string {
  const head = `你是工作流编排助手。根据用户需求生成一个**有向无环**工作流图，只输出 JSON，不要任何解释或 markdown 代码块。`

  if (skills.length === 0) {
    // 无可用 Skill 时明确禁用 tool 节点——否则模型会凭空造一个 tool_id，
    // 生成出一条永远校验不过的流程，比不生成更糟
    return `${head}
节点类型仅限：start / llm / end / if-else（start=开始入口，llm=大模型处理，end=结束输出，if-else=条件分支）。
⚠️ 当前工作区没有可用的已发布 Skill，**禁止**生成 tool 节点。
若需求涉及联网检索、调用外部系统等本模型做不到的能力，仍照常编排 llm 节点，
但在该节点 label 上注明「需接入 XX 能力」，提示用户后续手动挂载。
${BASE_RULES}
输出格式（严格）：{"nodes":[{"id":"唯一id","type":"节点类型","label":"简短中文名"}],"edges":[{"source":"起点id","target":"终点id"}]}`
  }

  const list = skills
    .map((s) => `- id=${s.id}｜${s.name}${s.type ? `（${s.type}）` : ''}${s.description ? `：${String(s.description).slice(0, 60)}` : ''}`)
    .join('\n')

  return `${head}
节点类型仅限：${ALLOWED_TYPES.join(' / ')}（start=开始入口，llm=大模型处理，end=结束输出，if-else=条件分支，tool=调用已有能力）。

需求中涉及**联网检索、读写外部系统、发送消息**等大模型自身做不到的动作时，必须用 tool 节点，
不要用 llm 节点假装完成——那样生成的流程看着完整，跑起来却是模型编造的内容。

可选用的能力清单（**只能从中选择，禁止编造 id**）：
${list}

tool 节点格式：{"id":"唯一id","type":"tool","label":"简短中文名","config":{"tool_id":"上表中的 id"}}
若清单里没有能满足需求的能力，就用 llm 节点并在 label 注明「需接入 XX 能力」。
${BASE_RULES}
输出格式（严格）：{"nodes":[...],"edges":[{"source":"起点id","target":"终点id"}]}`
}

export type CopilotResult = {
  graph: WorkflowGraph
  validation: GraphError[]
  valid: boolean
  raw?: string
}

function extractJson(text: string): string {
  // 去掉可能的 ```json ... ``` 包裹
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

function parseGraph(text: string): WorkflowGraph | null {
  try {
    const obj = JSON.parse(extractJson(text)) as { nodes?: unknown; edges?: unknown }
    const nodes = Array.isArray(obj.nodes)
      ? obj.nodes.map((n) => {
          const nn = n as Record<string, unknown>
          const base = { id: String(nn.id ?? ''), type: String(nn.type ?? ''), label: String(nn.label ?? '') }
          // WF-3：tool 节点的 tool_id 落到 data.config，与 validateToolNodes 读取路径一致。
          // 模型可能把它写在顶层 config，也可能写进 data.config，两种都收
          if (base.type === 'tool') {
            const cfg = (nn.config ?? (nn.data as Record<string, unknown> | undefined)?.config ?? {}) as Record<string, unknown>
            const toolId = typeof cfg.tool_id === 'string' ? cfg.tool_id
              : typeof cfg.skill_id === 'string' ? cfg.skill_id : ''
            return { ...base, data: { config: { tool_id: toolId } } }
          }
          return base
        })
      : []
    const edges = Array.isArray(obj.edges)
      ? obj.edges.map((e) => {
          const ee = e as Record<string, unknown>
          return { source: String(ee.source ?? ''), target: String(ee.target ?? '') }
        })
      : []
    return { nodes, edges }
  } catch {
    return null
  }
}

/**
 * WF-3 安全边界：把模型编造的 tool_id 降级为 llm 节点。
 *
 * 🔴 不能只靠 prompt 说「禁止编造 id」——模型照样会编。若放任不管，
 * 生成的流程会引用一个不存在的 Skill，validateToolNodes 报错、用户拿到一条
 * 永远校验不过的流程，比不生成 tool 节点更糟。
 * 降级而非丢弃：节点位置和连线都保留，label 标注需人工挂载，流程结构不塌。
 */
export function sanitizeToolNodes(graph: WorkflowGraph, allowedIds: Set<string>): WorkflowGraph {
  return {
    ...graph,
    nodes: (graph.nodes ?? []).map((n) => {
      // GraphNode 只声明 id/type，label 与 data 是结构外附加字段，故此处显式放宽
      const node = n as GraphNode & { label?: string; data?: { config?: { tool_id?: string } } }
      if (node.type !== 'tool') return n
      const id = node.data?.config?.tool_id ?? ''
      if (id && allowedIds.has(id)) return n
      return {
        id: node.id,
        type: 'llm',
        label: `${node.label ?? '外部能力'}（需接入能力，请手动挂载）`,
      }
    }),
  }
}

/** 根据描述生成工作流图（draft）。生成后即校验；非法则再让模型修一次。 */
export async function generateWorkflowGraph(
  description: string,
  availableSkills: AvailableSkill[] = [],
): Promise<CopilotResult> {
  const allowedIds = new Set(availableSkills.map((s) => s.id))
  const SYSTEM_PROMPT = buildSystemPrompt(availableSkills)
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `需求：${description}` },
  ]
  let raw = await chat(messages, { temperature: 0.2, maxTokens: 1200 })
  // 先净化再校验：编造的 tool_id 已降级为 llm，校验看到的是最终会落库的图
  let graph = sanitizeToolNodes(parseGraph(raw) ?? { nodes: [], edges: [] }, allowedIds)
  let validation = validateGraph(graph)

  // 一次修复轮：把校验错误回喂模型
  if (validation.length > 0 && parseGraph(raw)) {
    const fix = await chat(
      [
        ...messages,
        { role: 'assistant' as const, content: raw },
        { role: 'user' as const, content: `上面的图有问题：${validation.map((v) => v.message).join('；')}。请修正后重新只输出 JSON。` },
      ],
      { temperature: 0.1, maxTokens: 1200 },
    )
    const parsedFix = parseGraph(fix)
    if (parsedFix) {
      const fixed = sanitizeToolNodes(parsedFix, allowedIds)
      const fixedErrs = validateGraph(fixed)
      if (fixedErrs.length < validation.length) { raw = fix; graph = fixed; validation = fixedErrs }
    }
  }

  return { graph, validation, valid: validation.length === 0, raw }
}
