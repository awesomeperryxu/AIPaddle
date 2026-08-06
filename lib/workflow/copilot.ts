import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError, type GraphNode } from '@/lib/workflow/validate'

// Workflow Copilot（4.4.5，ADR-005）：自然语言 → 结构化工作流图（draft）。
// 四道防线：① 白名单节点类型 ② 强制 JSON 结构 ③ 图校验 ④ 仅产 draft、AI 不能发布/保存。
// ③ 澄清面板  ④ 扩展节点类型（17种）  ⑤ 增量修改

const NODE_TYPES = {
  'start': '开始入口',
  'end': '结束输出',
  'llm': '大模型处理',
  'if-else': '条件分支',
  'question-classifier': '问题分类器',
  'parameter-extractor': '参数提取',
  'knowledge-retrieval': '知识库检索',
  'tool': '工具调用（Plugin Tool）',
  'http-request': 'HTTP 请求',
  'code': '代码执行',
  'template-transform': '模板转换',
  'variable-assigner': '变量赋值',
  'iteration': '迭代（列表逐项处理）',
  'human-input': '人工审核',
  'agent': 'Agent 节点',
  'sub-workflow': '子工作流',
  'answer': '对话回复（仅 Chatflow）',
} as const

const NODE_LIST = Object.entries(NODE_TYPES).map(([k, v]) => `${k}: ${v}`).join('\n')

/** 可供 Copilot 选用的 Skill（调用方从数据层取「本租户已发布」的传入） */
export type AvailableSkill = { id: string; name: string; description?: string | null; type?: string | null }

export type ClarificationItem = { field: string; question: string; options?: string[] }

const BASE_RULES = `硬性要求：
① 恰好一个 start 节点、至少一个 end 或 answer 节点
② 每个节点都要连入流程（无孤立节点）
③ 不能有环（有向无环图）
④ 节点 id 格式：类型-序号（如 llm-1、if-else-2）`

function buildSystemPrompt(existingGraph?: WorkflowGraph, skills?: AvailableSkill[]): string {
  let prompt = `你是工作流编排助手。根据用户需求生成或修改工作流图。只输出 JSON，不要任何解释或 markdown 代码块。

可用节点类型：
${NODE_LIST}

${BASE_RULES}

输出格式（严格 JSON）：
{
  "nodes": [{"id":"唯一id","type":"节点类型","label":"简短中文名","config":{}}],
  "edges": [{"source":"起点id","target":"终点id"}],
  "clarifications": [{"field":"需要用户补充的配置项","question":"问用户的问题","options":["选项1","选项2"]}]
}

clarifications 规则：
- 如果用户描述足够完整，clarifications 为空数组
- 如果缺少必要信息（如用哪个知识库、分支条件、调用哪个 Tool），列出需要澄清的问题
- 每个问题提供可选项（如果有的话）`

  // WF-3：可用 Skill 清单
  if (skills && skills.length > 0) {
    const list = skills
      .map((s) => `- id=${s.id}｜${s.name}${s.type ? `（${s.type}）` : ''}${s.description ? `：${String(s.description).slice(0, 60)}` : ''}`)
      .join('\n')
    prompt += `\n\ntool 节点必须引用已有能力（**只能从中选择，禁止编造 id**）：
${list}
tool 节点格式：{"id":"唯一id","type":"tool","label":"简短中文名","config":{"tool_id":"上表中的 id"}}
若清单里没有能满足需求的能力，就用 llm 节点并在 label 注明「需接入 XX 能力」。`
  } else {
    prompt += `\n\n⚠️ 当前工作区没有可用的已发布 Skill，**禁止**生成 tool 节点。
若需求涉及联网检索、调用外部系统等本模型做不到的能力，仍照常编排 llm 节点，
但在该节点 label 上注明「需接入 XX 能力」。`
  }

  // ⑤ 增量修改
  if (existingGraph && existingGraph.nodes.length > 0) {
    prompt += `\n\n当前工作流已有以下节点和连线，请在此基础上**增量修改**（保留未提到的节点，只改用户要求的部分）：\n${JSON.stringify(existingGraph)}`
  }
  return prompt
}

export type CopilotResult = {
  graph: WorkflowGraph
  validation: GraphError[]
  valid: boolean
  clarifications: ClarificationItem[]
  raw?: string
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

function parseResult(text: string): { graph: WorkflowGraph; clarifications: ClarificationItem[] } | null {
  try {
    const obj = JSON.parse(extractJson(text)) as Record<string, unknown>
    const nodes = Array.isArray(obj.nodes)
      ? obj.nodes.map((n) => {
          const nn = n as Record<string, unknown>
          const base = { id: String(nn.id ?? ''), type: String(nn.type ?? ''), label: String(nn.label ?? '') }
          if (base.type === 'tool') {
            const cfg = (nn.config ?? (nn.data as Record<string, unknown> | undefined)?.config ?? {}) as Record<string, unknown>
            const toolId = typeof cfg.tool_id === 'string' ? cfg.tool_id
              : typeof cfg.skill_id === 'string' ? cfg.skill_id : ''
            return { ...base, data: { config: { tool_id: toolId } } }
          }
          return { ...base, ...(nn.config && typeof nn.config === 'object' ? { config: nn.config } : {}) }
        })
      : []
    const edges = Array.isArray(obj.edges)
      ? obj.edges.map((e) => {
          const ee = e as Record<string, unknown>
          return { source: String(ee.source ?? ''), target: String(ee.target ?? '') }
        })
      : []
    const clarifications = Array.isArray(obj.clarifications)
      ? obj.clarifications
          .map((c) => {
            const cc = c as Record<string, unknown>
            return {
              field: String(cc.field ?? ''),
              question: String(cc.question ?? ''),
              options: Array.isArray(cc.options) ? cc.options.map(String) : undefined,
            }
          })
          .filter((c) => c.question)
      : []
    return { graph: { nodes, edges }, clarifications }
  } catch {
    return null
  }
}

/**
 * WF-3 安全边界：把模型编造的 tool_id 降级为 llm 节点。
 * 降级而非丢弃：节点位置和连线都保留，label 标注需人工挂载，流程结构不塌。
 */
export function sanitizeToolNodes(graph: WorkflowGraph, allowedIds: Set<string>): WorkflowGraph {
  return {
    ...graph,
    nodes: (graph.nodes ?? []).map((n) => {
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

export type CopilotOptions = {
  existingGraph?: WorkflowGraph
  availableSkills?: AvailableSkill[]
}

/** 根据描述生成工作流图（draft）。支持增量修改、Skill 清单、澄清面板。 */
export async function generateWorkflowGraph(
  description: string,
  existingGraphOrOpts?: WorkflowGraph | CopilotOptions | AvailableSkill[],
): Promise<CopilotResult> {
  // 兼容三种调用方式
  let opts: CopilotOptions
  if (Array.isArray(existingGraphOrOpts)) {
    opts = { availableSkills: existingGraphOrOpts }
  } else if (existingGraphOrOpts && 'nodes' in existingGraphOrOpts) {
    opts = { existingGraph: existingGraphOrOpts }
  } else {
    opts = (existingGraphOrOpts as CopilotOptions) ?? {}
  }

  const allowedIds = new Set((opts.availableSkills ?? []).map((s) => s.id))
  const systemPrompt = buildSystemPrompt(opts.existingGraph, opts.availableSkills)
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `需求：${description}` },
  ]
  let raw = await chat(messages, { temperature: 0.2, maxTokens: 2000 })
  const parsed = parseResult(raw)
  let graph = sanitizeToolNodes(parsed?.graph ?? { nodes: [], edges: [] }, allowedIds)
  let clarifications = parsed?.clarifications ?? []
  let validation = validateGraph(graph)

  // 一次修复轮
  if (validation.length > 0 && parsed) {
    const fix = await chat(
      [...messages,
        { role: 'assistant' as const, content: raw },
        { role: 'user' as const, content: `上面的图有问题：${validation.map((v) => v.message).join('；')}。请修正后重新只输出完整 JSON。` },
      ],
      { temperature: 0.1, maxTokens: 2000 },
    )
    const fixParsed = parseResult(fix)
    if (fixParsed) {
      const fixed = sanitizeToolNodes(fixParsed.graph, allowedIds)
      const fixedErrs = validateGraph(fixed)
      if (fixedErrs.length < validation.length) {
        raw = fix; graph = fixed; clarifications = fixParsed.clarifications; validation = fixedErrs
      }
    }
  }

  return { graph, validation, valid: validation.length === 0, clarifications, raw }
}
