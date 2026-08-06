import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError, type GraphNode } from '@/lib/workflow/validate'
import { layoutGraph } from '@/lib/workflow/layout'
import type { PersistedGraph, PersistedNode, PersistedEdge } from '@/lib/workflow/graph-adapter'

// Workflow Copilot（4.4.5，ADR-005）：自然语言 → 结构化工作流图（draft）。
// 四道防线：① 白名单节点类型 ② 强制 JSON 结构 ③ 图校验 ④ 仅产 draft、AI 不能发布/保存。
// ③ 澄清面板  ④ 扩展节点类型（18种）  ⑤ 增量修改
//
// WF-7/5/6：模型直出的图**不能直接上画布**，必须经 normalizeGraph 规范化——
// 否则节点没坐标（全部重叠成一坨）、label 落不进 data.label（画布只显示类型名）、
// if-else 出边没有 sourceHandle（挂不上分支句柄，执行引擎也永远不命中）。

const NODE_TYPES = {
  'start': '开始入口',
  'trigger-schedule': '定时触发入口（周期性需求用它替代 start）',
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

/** 模型直出的松散节点/边形状（顶层 label/config、边上 branch），规范化后才对外 */
export type RawNode = { id: string; type: string; label?: string; description?: string; config?: Record<string, unknown> }
export type RawEdge = { source: string; target: string; branch?: string }
export type RawGraph = { nodes: RawNode[]; edges: RawEdge[] }

const TYPE_LABELS: Record<string, string> = {
  'start': '开始',
  'trigger-schedule': '定时触发',
  'llm': '大模型处理',
  'end': '结束',
  'if-else': '条件分支',
  'tool': '调用能力',
}

const BASE_RULES = `硬性要求：
① 恰好一个入口节点（start 或 trigger-schedule 二选一）、至少一个 end 或 answer 节点
② 每个节点都要连入流程（无孤立节点）
③ 不能有环（有向无环图）
④ 节点 id 格式：类型-序号（如 llm-1、if-else-2）
⑤ 除非需求真的要分支，否则**只留一个 end**，不要为每条路径各造一个结束节点
⑥ 节点 label 用简短中文动词短语（如「检索昨日AI资讯」），不要写成节点类型名`

const NODE_FORMAT = `节点配置要求：
- llm 节点必须给 config.prompt，写清这一步做什么，用 {{input}} 引用上一步输出；
  例：{"id":"llm-1","type":"llm","label":"提炼要点","config":{"prompt":"从以下内容提炼要点：\\n{{input}}"}}
- 需求含「每天/每周/每小时/定时/几点运行」等周期性字眼时，入口节点用 trigger-schedule 而非 start，
  并把时间翻成 cron：{"id":"trigger-1","type":"trigger-schedule","label":"每天8点触发","config":{"cron":"0 8 * * *","timezone":"Asia/Shanghai"}}
- if-else 的每条出边必须标明分支：{"source":"if-else-1","target":"llm-2","branch":"if-true"}，
  取值只能是 if-true / elif-1 / elif-2 / else，且**必须有一条 else 边**。
  不标 branch 的分支边在画布上会挂空，流程跑到分支处就断了。`

/** 增量修改时喂给模型的图：转回扁平 label/config，与要求它输出的格式一致，免得它照抄嵌套结构 */
function toModelGraph(graph: WorkflowGraph | PersistedGraph): RawGraph {
  type LooseNode = GraphNode & {
    label?: string
    config?: Record<string, unknown>
    data?: { label?: string; config?: Record<string, unknown> }
  }
  const nodes = (graph.nodes ?? []) as LooseNode[]
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data?.label ?? n.label ?? '',
      config: n.data?.config ?? n.config ?? {},
    })),
    edges: (graph.edges ?? []).map((e) => {
      const ee = e as PersistedEdge
      return { source: ee.source, target: ee.target, ...(ee.sourceHandle ? { branch: ee.sourceHandle } : {}) }
    }),
  }
}

function buildSystemPrompt(existingGraph?: WorkflowGraph, skills?: AvailableSkill[]): string {
  let prompt = `你是工作流编排助手。根据用户需求生成或修改工作流图。只输出 JSON，不要任何解释或 markdown 代码块。

可用节点类型：
${NODE_LIST}

${BASE_RULES}

${NODE_FORMAT}

输出格式（严格 JSON）：
{
  "nodes": [{"id":"唯一id","type":"节点类型","label":"简短中文名","config":{}}],
  "edges": [{"source":"起点id","target":"终点id","branch":"仅 if-else 出边需要"}],
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
    prompt += `\n\n当前工作流已有以下节点和连线，请在此基础上**增量修改**（保留未提到的节点，只改用户要求的部分）：\n${JSON.stringify(toModelGraph(existingGraph))}`
  }
  return prompt
}

export type CopilotResult = {
  graph: PersistedGraph
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

/** 取节点配置：模型可能写在顶层 config，也可能写进 data.config，两种都收 */
function pickConfig(nn: Record<string, unknown>): Record<string, unknown> {
  const top = nn.config && typeof nn.config === 'object' ? (nn.config as Record<string, unknown>) : {}
  const nested = (nn.data as Record<string, unknown> | undefined)?.config
  const inner = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : {}
  return { ...inner, ...top }
}

function parseResult(text: string): { graph: RawGraph; clarifications: ClarificationItem[] } | null {
  try {
    const obj = JSON.parse(extractJson(text)) as Record<string, unknown>
    const nodes: RawNode[] = Array.isArray(obj.nodes)
      ? obj.nodes.map((n) => {
          const nn = n as Record<string, unknown>
          const label = String(nn.label ?? (nn.data as Record<string, unknown> | undefined)?.label ?? '')
          return {
            id: String(nn.id ?? ''),
            type: String(nn.type ?? ''),
            label,
            ...(typeof nn.description === 'string' ? { description: nn.description } : {}),
            config: pickConfig(nn),
          }
        })
      : []
    const edges: RawEdge[] = Array.isArray(obj.edges)
      ? obj.edges.map((e) => {
          const ee = e as Record<string, unknown>
          const branch = ee.branch ?? ee.sourceHandle ?? ee.case ?? ee.caseId
          return {
            source: String(ee.source ?? ''),
            target: String(ee.target ?? ''),
            ...(typeof branch === 'string' && branch ? { branch } : {}),
          }
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
 *
 * 🔴 不能只靠 prompt 说「禁止编造 id」——模型照样会编。放任不管会生成一条引用
 * 不存在 Skill、永远校验不过的流程，比不生成 tool 节点更糟。
 * 降级而非丢弃：节点 id 与连线都保留，label 标注需人工挂载，流程结构不塌。
 */
export function sanitizeToolNodes(graph: RawGraph, allowedIds: Set<string>): RawGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.type !== 'tool') return n
      const cfg = n.config ?? {}
      const id = typeof cfg.tool_id === 'string' ? cfg.tool_id
        : typeof cfg.skill_id === 'string' ? cfg.skill_id : ''
      if (id && allowedIds.has(id)) return { ...n, config: { ...cfg, tool_id: id } }
      return { ...n, type: 'llm', label: `${n.label || '外部能力'}（需接入能力，请手动挂载）`, config: {} }
    }),
  }
}

// 与 configs/schedule-config.tsx 的 SCHEDULE_PRESETS 一一对应，
// 不然面板会把「每天8点」显示成「自定义 cron」
const CRON_PRESETS: Record<string, string> = {
  '0 * * * *': 'every_hour',
  '0 8 * * *': 'daily_8am',
  '0 9 * * *': 'daily_9am',
  '0 9 * * 1': 'weekly_monday',
  '0 9 1 * *': 'monthly_first',
}
const CRON_RE = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/

/** 定时触发节点补全：cron 缺失或不合法时回落每天 9 点，并补上配置面板要读的 schedule_preset */
function normalizeScheduleConfig(config: Record<string, unknown>): Record<string, unknown> {
  const raw = typeof config.cron === 'string' ? config.cron.trim()
    : typeof config.cron_expression === 'string' ? String(config.cron_expression).trim() : ''
  const cron = CRON_RE.test(raw) ? raw : '0 9 * * *'
  const timezone = typeof config.timezone === 'string' && config.timezone ? config.timezone : 'Asia/Shanghai'
  return { ...config, cron, timezone, schedule_preset: CRON_PRESETS[cron] ?? 'custom' }
}

const BRANCH_RE = /^(if-true|else|elif-\d+)$/

/**
 * if-else 出边补 sourceHandle（WF-6）。
 *
 * 🔴 画布上的 if-else 节点只有带 id 的 if-true / elif-N / else 出口句柄，
 * 执行引擎也按 `edge.sourceHandle === 命中分支` 路由（execute.ts）。
 * 模型给的边没有 branch 时，这条边既挂不到句柄上、跑起来也永远不命中——
 * 流程在分支处直接断掉。这里按出边顺序补齐：首条 if-true、末条 else、中间 elif-N。
 */
function assignBranches(nodes: RawNode[], edges: RawEdge[]): { edges: PersistedEdge[]; casesByNode: Map<string, unknown[]> } {
  const ifElseIds = new Set(nodes.filter((n) => n.type === 'if-else').map((n) => n.id))
  const casesByNode = new Map<string, unknown[]>()
  const outIndex = new Map<string, number>()
  const outTotal = new Map<string, number>()
  for (const e of edges) if (ifElseIds.has(e.source)) outTotal.set(e.source, (outTotal.get(e.source) ?? 0) + 1)

  const outEdges: PersistedEdge[] = edges.map((e) => {
    const base: PersistedEdge = { id: `${e.source}-${e.target}`, source: e.source, target: e.target }
    if (!ifElseIds.has(e.source)) return base

    const i = outIndex.get(e.source) ?? 0
    outIndex.set(e.source, i + 1)
    const total = outTotal.get(e.source) ?? 1
    // 模型标了合法 branch 就用它；否则按顺序推断（末条留给 else）
    const fallback = total === 1 ? 'if-true' : i === total - 1 ? 'else' : i === 0 ? 'if-true' : `elif-${i}`
    const handle = e.branch && BRANCH_RE.test(e.branch) ? e.branch : fallback

    const list = casesByNode.get(e.source) ?? []
    if (handle !== 'else' && !list.some((c) => (c as { caseId?: string }).caseId === handle)) {
      // 条件留空——AI 猜不出用户真正的判断条件，留给用户在配置面板里填。
      // 空条件在执行引擎里视为不命中，会走 else，不会产生「假装判断过」的假象。
      list.push({ id: `${e.source}-${handle}`, caseId: handle, logicalOperator: 'and', conditions: [] })
    }
    casesByNode.set(e.source, list)
    return { ...base, id: `${e.source}-${handle}-${e.target}`, sourceHandle: handle }
  })

  return { edges: outEdges, casesByNode }
}

/**
 * 模型直出图 → 可直接上画布的持久化图（WF-7/WF-5/WF-6）。
 *
 * 三件事：① label/description/config 收进 data（`graph-adapter` 读的是 data.label，
 * 顶层 label 会被整个丢掉，画布上于是显示 "llm"/"end" 这种类型名）；
 * ② if-else 出边补 sourceHandle 并回填 cases；③ 自动布局算出 position。
 */
export function normalizeGraph(raw: RawGraph): PersistedGraph {
  const nodes = raw.nodes.filter((n) => n.id && n.type)
  const { edges, casesByNode } = assignBranches(nodes, raw.edges.filter((e) => e.source && e.target))
  const positions = layoutGraph(nodes, edges)

  const persisted: PersistedNode[] = nodes.map((n) => {
    let config = n.config ?? {}
    if (n.type === 'trigger-schedule') config = normalizeScheduleConfig(config)
    if (n.type === 'if-else') {
      const cases = casesByNode.get(n.id)
      if (cases?.length) config = { ...config, cases }
    }
    return {
      id: n.id,
      type: n.type,
      position: positions[n.id] ?? { x: 80, y: 80 },
      data: {
        label: n.label || TYPE_LABELS[n.type] || n.type,
        ...(n.description ? { description: n.description } : {}),
        config,
      },
    }
  })

  return { nodes: persisted, edges }
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
  // 先净化再规范化再校验：校验看到的必须是最终会落库、会上画布的那张图
  let graph = normalizeGraph(sanitizeToolNodes(parsed?.graph ?? { nodes: [], edges: [] }, allowedIds))
  let clarifications = parsed?.clarifications ?? []
  let validation = validateGraph({ nodes: graph.nodes as GraphNode[], edges: graph.edges })

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
      const fixed = normalizeGraph(sanitizeToolNodes(fixParsed.graph, allowedIds))
      const fixedErrs = validateGraph({ nodes: fixed.nodes as GraphNode[], edges: fixed.edges })
      if (fixedErrs.length < validation.length) {
        raw = fix; graph = fixed; clarifications = fixParsed.clarifications; validation = fixedErrs
      }
    }
  }

  return { graph, validation, valid: validation.length === 0, clarifications, raw }
}
