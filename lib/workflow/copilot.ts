import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError, type GraphNode } from '@/lib/workflow/validate'

// Workflow Copilot（PRD 2.11 / ADR-005）：自然语言 → 结构化工作流图。
// ③ 澄清面板  ④ 扩展节点类型  ⑤ 增量修改

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

function buildSystemPrompt(existingGraph?: WorkflowGraph): string {
  const base = `你是工作流编排助手。根据用户需求生成或修改工作流图。只输出 JSON，不要任何解释或 markdown 代码块。

可用节点类型：
${NODE_LIST}

硬性要求：
① 恰好一个 start 节点、至少一个 end 或 answer 节点
② 每个节点都要连入流程（无孤立节点）
③ 不能有环（有向无环图）
④ 节点 id 格式：类型-序号（如 llm-1、if-else-2）

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

  if (existingGraph && existingGraph.nodes.length > 0) {
    return base + `\n\n当前工作流已有以下节点和连线，请在此基础上**增量修改**（保留未提到的节点，只改用户要求的部分）：\n${JSON.stringify(existingGraph)}`
  }
  return base
}

export type ClarificationItem = { field: string; question: string; options?: string[] }

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
          return {
            id: String(nn.id ?? ''), type: String(nn.type ?? ''), label: String(nn.label ?? ''),
            ...(nn.config && typeof nn.config === 'object' ? { config: nn.config } : {}),
          }
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

export async function generateWorkflowGraph(
  description: string,
  existingGraph?: WorkflowGraph,
): Promise<CopilotResult> {
  const systemPrompt = buildSystemPrompt(existingGraph)
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `需求：${description}` },
  ]
  let raw = await chat(messages, { temperature: 0.3, maxTokens: 2000 })
  const parsed = parseResult(raw)
  let graph = parsed?.graph ?? { nodes: [], edges: [] }
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
      const fixedErrs = validateGraph(fixParsed.graph)
      if (fixedErrs.length < validation.length) {
        raw = fix; graph = fixParsed.graph; clarifications = fixParsed.clarifications; validation = fixedErrs
      }
    }
  }

  return { graph, validation, valid: validation.length === 0, clarifications, raw }
}
