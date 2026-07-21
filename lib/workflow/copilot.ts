import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError } from '@/lib/workflow/validate'

// Workflow Copilot（4.4.5，ADR-005）：自然语言 → 结构化工作流图（draft）。
// 四道防线：① 白名单节点类型 ② 强制 JSON 结构 ③ 图校验 ④ 仅产 draft、AI 不能发布/保存（由用户采纳后走既有 PATCH）。
// 首版仅生成基础节点（start/llm/end/if-else）；Tool/Skill 节点需 4.3.x/C 道，暂不生成。

const ALLOWED_TYPES = ['start', 'llm', 'end', 'if-else'] as const

const SYSTEM_PROMPT = `你是工作流编排助手。根据用户需求生成一个**有向无环**工作流图，只输出 JSON，不要任何解释或 markdown 代码块。
节点类型仅限：${ALLOWED_TYPES.join(' / ')}（start=开始入口，llm=大模型处理，end=结束输出，if-else=条件分支）。
硬性要求：① 恰好一个 start、至少一个 end；② 每个节点都要连入流程（无孤立节点）；③ 不能有环。
输出格式（严格）：{"nodes":[{"id":"唯一id","type":"节点类型","label":"简短中文名"}],"edges":[{"source":"起点id","target":"终点id"}]}`

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
          return { id: String(nn.id ?? ''), type: String(nn.type ?? ''), label: String(nn.label ?? '') }
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

/** 根据描述生成工作流图（draft）。生成后即校验；非法则再让模型修一次。 */
export async function generateWorkflowGraph(description: string): Promise<CopilotResult> {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `需求：${description}` },
  ]
  let raw = await chat(messages, { temperature: 0.2, maxTokens: 1200 })
  let graph = parseGraph(raw) ?? { nodes: [], edges: [] }
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
    const fixed = parseGraph(fix)
    if (fixed) {
      const fixedErrs = validateGraph(fixed)
      if (fixedErrs.length < validation.length) { raw = fix; graph = fixed; validation = fixedErrs }
    }
  }

  return { graph, validation, valid: validation.length === 0, raw }
}
