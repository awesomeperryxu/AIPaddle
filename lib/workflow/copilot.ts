import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph, type GraphError, type GraphNode } from '@/lib/workflow/validate'
import { layoutGraph } from '@/lib/workflow/layout'
import type { PersistedGraph, PersistedNode, PersistedEdge, WorkflowSchedule } from '@/lib/workflow/graph-adapter'
import { isUsableUrl } from '@/lib/workflow/readiness'
import { parseCronFromText, mentionsSchedule } from '@/lib/workflow/schedule-parse'

// Workflow Copilot（4.4.5，ADR-005）：自然语言 → 结构化工作流图（draft）。
// 四道防线：① 白名单节点类型 ② 强制 JSON 结构 ③ 图校验 ④ 仅产 draft、AI 不能发布/保存。
// ③ 澄清面板  ④ 扩展节点类型（18种）  ⑤ 增量修改
//
// WF-7/5/6：模型直出的图**不能直接上画布**，必须经 normalizeGraph 规范化——
// 否则节点没坐标（全部重叠成一坨）、label 落不进 data.label（画布只显示类型名）、
// if-else 出边没有 sourceHandle（挂不上分支句柄，执行引擎也永远不命中）。

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

/** 模型直出的松散节点/边形状（顶层 label/config、边上 branch），规范化后才对外 */
export type RawNode = { id: string; type: string; label?: string; description?: string; config?: Record<string, unknown> }
export type RawEdge = { source: string; target: string; branch?: string }
export type RawGraph = { nodes: RawNode[]; edges: RawEdge[]; schedule?: WorkflowSchedule }

const TYPE_LABELS: Record<string, string> = {
  'start': '开始',
  'trigger-schedule': '定时触发',
  'llm': '大模型处理',
  'end': '结束',
  'if-else': '条件分支',
  'tool': '调用能力',
}

const BASE_RULES = `硬性要求：
① 恰好一个 start 节点、至少一个 end 或 answer 节点
② 每个节点都要连入流程（无孤立节点）
③ 不能有环（有向无环图）
④ 节点 id 格式：类型-序号（如 llm-1、if-else-2）
⑤ 除非需求真的要分支，否则**只留一个 end**，不要为每条路径各造一个结束节点
⑥ 需求含「每天/每周/每小时/定时/几点运行」等周期性字眼时，**必须**在 JSON 顶层输出
   schedule 字段，且**不要**为定时单独加节点——定时是「什么时候跑」的运行属性，
   与「跑什么」的流程内容解耦。漏掉 schedule 等于把用户的定时需求丢了。

🔴 绝对禁止（违反即整条流程作废，用户拿到就是坏的）：
⑦ **不要编造 URL、域名、接口地址、API Key**。像「https://api.example-search.com/v1/search」
   这类假地址一跑就失败。没有真实可用的接口时，**不要用 http-request 节点**。
⑧ **不要用节点假装完成模型做不到的事**。联网检索、读写外部系统、发消息，
   只有在下方能力清单里有对应 Skill 时才能编排；没有就**不要硬造这一步**，
   改为在 clarifications 里问用户「用哪个渠道/接口获取数据」。
⑨ **不要拆出用户没要求的臆想中间步骤**。以下这类节点一律不许出现：
   ✗「生成检索关键词」✗「构造查询语句」✗「推断昨天的日期」✗「准备请求参数」——
   它们是实现细节，不是业务步骤，用户看不懂也没要求。这些工作应当**并进真正干活的那一步的提示词里**。
   正例（查昨日AI大事件）：抓取前一日的AI资讯 → 筛选重要事件并摘要 → 输出简报，**三步即可**。

命名要求：
⑩ 节点 label 用**用户视角的业务动作**，短句、中文、动宾结构，
   例：「抓取前一日的AI大事件」「筛选重要事件并摘要」「输出简报」；
   不要写成节点类型名（llm/end），也不要写实现细节（「调用LLM生成关键词」）。`

const NODE_FORMAT = `节点配置要求（**每个节点都必须填满自己的配置，不能只给 label**）：
- llm 节点必须给 config.prompt，写清这一步做什么，用 {{input}} 引用上一步输出；
  例：{"id":"llm-1","type":"llm","label":"筛选重要事件并摘要","config":{"prompt":"从以下内容提炼要点：\\n{{input}}"}}
- http-request 节点必须给 config.url（**真实可用的地址**）与 config.method；
  编不出真实地址就不要用这个节点——宁可少一步，也不要给用户一条注定 404 的流程
- knowledge-retrieval 必须给 config.dataset_ids；if-else 必须给每个分支的判断条件
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
    // 带上现有定时设置，模型改流程时才不会把它当成「没设过」丢掉
    ...((graph as PersistedGraph).schedule ? { schedule: (graph as PersistedGraph).schedule } : {}),
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
  "schedule": {"enabled":true,"cron":"0 8 * * *","timezone":"Asia/Shanghai"},
  "clarifications": [{"field":"需要用户补充的配置项","question":"问用户的问题","options":["选项1","选项2"]}]
}

schedule 规则：有周期性要求时必填（cron 用五段式），没有就整个省略这个字段。

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
    const schedule = parseSchedule(obj.schedule)
    return { graph: { nodes, edges, ...(schedule ? { schedule } : {}) }, clarifications }
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
      // WF-12：http-request 的假 URL 与编造的 tool_id 是同一类病。
      // 模型很爱写 `https://api.example-search.com/v1/search` 这种看着像真的地址，
      // 光靠 prompt 说「不要编造」拦不住。这里不删节点（删了流程会缺一环、
      // 用户也不知道它本来想干什么），而是清空假地址并在 label 上标出来，
      // 由体检（readiness）把它列为发布拦截项。
      if (n.type === 'http-request') {
        const url = typeof n.config?.url === 'string' ? n.config.url : ''
        if (url && !isUsableUrl(url)) {
          return {
            ...n,
            label: `${n.label || '外部接口调用'}（地址需人工填写）`,
            config: { ...n.config, url: '' },
          }
        }
        return n
      }
      if (n.type !== 'tool') return n
      const cfg = n.config ?? {}
      const id = typeof cfg.tool_id === 'string' ? cfg.tool_id
        : typeof cfg.skill_id === 'string' ? cfg.skill_id : ''
      if (id && allowedIds.has(id)) return { ...n, config: { ...cfg, tool_id: id } }
      return { ...n, type: 'llm', label: `${n.label || '外部能力'}（需接入能力，请手动挂载）`, config: {} }
    }),
  }
}

const CRON_RE = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/

/**
 * 解析模型给出的定时设置（WF-2b）。
 *
 * 🔴 定时**不落成画布节点**：用户明确要求「定时任务要和流程内容解耦」——
 * 「什么时候跑」是工作流的运行属性，画布只画「跑什么」。
 * cron 不合法就整个丢弃，不猜时间：猜错会让用户以为设好了，比没设更危险。
 */
function parseSchedule(value: unknown): WorkflowSchedule | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as Record<string, unknown>
  const raw = typeof v.cron === 'string' ? v.cron.trim()
    : typeof v.cron_expression === 'string' ? String(v.cron_expression).trim() : ''
  if (!CRON_RE.test(raw)) return undefined
  return {
    enabled: v.enabled !== false,
    cron: raw,
    timezone: typeof v.timezone === 'string' && v.timezone ? v.timezone : 'Asia/Shanghai',
  }
}

// 服务端实际在用的模型（lib/ai/index.ts 的 LLM_MODEL 默认值），生成时按它填，
// 免得面板显示 gpt-4o、真跑却是通义千问这种对不上的情况。
const DEFAULT_LLM = { provider: 'qwen', name: process.env.LLM_MODEL || 'qwen-plus', completion_params: { temperature: 0.7, max_tokens: 4096 } }

/**
 * LLM 节点配置补全（WF-10）。
 *
 * 🔴 同一份配置有三个读者，字段却对不上：
 *   - 执行引擎 `execute.ts` 读 `config.prompt`（单条字符串）
 *   - 配置面板 `llm-config.tsx` 读 `config.model` + `config.prompts`（PromptTemplate[]）
 *   - Copilot 此前只写 `config.prompt`
 * 结果就是用户点开生成的 LLM 节点，模型和提示词**全是空的**——看着像没配置，
 * 一旦在面板里随手保存，反而会把引擎要用的 prompt 覆盖没。
 * 这里把两种形态一次写全，并保持同一份文本。
 */
function normalizeLlmConfig(config: Record<string, unknown>, nodeId: string): Record<string, unknown> {
  const promptsIn = Array.isArray(config.prompts) ? (config.prompts as Record<string, unknown>[]) : []
  const fromPrompts = typeof promptsIn[0]?.text === 'string' ? String(promptsIn[0].text) : ''
  const text = (typeof config.prompt === 'string' && config.prompt.trim() ? config.prompt : fromPrompts).trim()
  if (!text) return config // 没有提示词就不硬造，交给体检报「待补」
  return {
    ...config,
    prompt: text,
    model: config.model && typeof config.model === 'object' ? config.model : DEFAULT_LLM,
    prompts: promptsIn.length ? promptsIn : [{ id: `${nodeId}-p1`, role: 'user', text }],
  }
}

/**
 * 折叠臆想的中间步骤（WF-14）。
 *
 * 🔴 模型很爱把实现细节拆成节点：「生成检索关键词」「推断昨天的日期」「构造查询语句」。
 * 用户看到的是一条步骤莫名其妙的流程——他要的是「抓取 → 筛选 → 输出」，
 * 不是模型的内心独白。prompt 里明令禁止后仍然复发（实测两轮都犯），只能确定性处理。
 *
 * 安全边界（三条同时满足才折叠，避免误删真业务步骤）：
 *   ① 类型是 llm；② label 命中实现细节黑名单；③ 恰好一进一出。
 * 折叠不丢信息：被折叠节点的提示词并入下游节点的提示词前段。
 */
// 动词与名词之间允许夹修饰语（「推断**昨天的**日期」「生成**昨日AI大事件检索**关键词」），
// 但名词表保持窄——只收公认的实现细节，避免误伤「生成简报」这类真业务步骤
const FILLER_LABEL_RE = /(生成|构造|构建|拼接|准备|推断|计算|确定|获取)[^，。；\s]{0,10}?(关键词|关键字|查询语句|查询条件|检索式|请求参数|入参|日期字符串|时间字符串|时间范围|的日期|昨天的日期|日期)(?![一-龥])/

export function collapseFillerNodes(graph: RawGraph): RawGraph {
  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()
  for (const e of graph.edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }

  let nodes = graph.nodes
  let edges = graph.edges
  for (const n of graph.nodes) {
    if (n.type !== 'llm' || !FILLER_LABEL_RE.test(n.label ?? '')) continue
    if ((inDeg.get(n.id) ?? 0) !== 1 || (outDeg.get(n.id) ?? 0) !== 1) continue

    const inEdge = edges.find((e) => e.target === n.id)
    const outEdge = edges.find((e) => e.source === n.id)
    if (!inEdge || !outEdge) continue
    const downstream = nodes.find((x) => x.id === outEdge.target)
    if (!downstream) continue

    // 提示词并入下游，别把模型想表达的意图丢掉
    const mine = typeof n.config?.prompt === 'string' ? n.config.prompt.trim() : ''
    if (mine && downstream.type === 'llm') {
      const theirs = typeof downstream.config?.prompt === 'string' ? downstream.config.prompt.trim() : ''
      downstream.config = { ...downstream.config, prompt: theirs ? `${mine}\n\n${theirs}` : mine }
    }

    nodes = nodes.filter((x) => x.id !== n.id)
    edges = edges
      .filter((e) => e !== outEdge)
      .map((e) => (e === inEdge ? { ...e, target: outEdge.target } : e))
  }
  return { ...graph, nodes, edges }
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
    if (n.type === 'llm') config = normalizeLlmConfig(config, n.id)
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

  // schedule 原样透传：它是图的元数据，不参与布局、不占节点
  return { nodes: persisted, edges, ...(raw.schedule ? { schedule: raw.schedule } : {}) }
}

/**
 * 定时兜底（WF-13）：模型没输出 schedule 时，用确定性规则从用户描述里解析。
 *
 * 🔴 实测 qwen-plus 对「每天早上8点运行」连续两次都不输出 schedule 字段，
 * prompt 怎么强调都压不住。定时是用户明说的需求，不能押在模型的指令遵循上。
 */
function withScheduleFallback(graph: PersistedGraph, description: string): PersistedGraph {
  if (graph.schedule) return graph
  if (!mentionsSchedule(description)) return graph
  const cron = parseCronFromText(description)
  if (!cron) return graph // 说了「定时」却没说清频率：不猜，留给用户在定时设置里填
  return { ...graph, schedule: { enabled: true, cron, timezone: 'Asia/Shanghai' } }
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
  // 生成 → 折叠臆想步骤 → 净化假 URL/编造 tool → 规范化 → 定时兜底。
  // 校验看到的必须是最终会落库、会上画布的那张图
  const finish = (g: RawGraph): PersistedGraph =>
    withScheduleFallback(normalizeGraph(sanitizeToolNodes(collapseFillerNodes(g), allowedIds)), description)

  let raw = await chat(messages, { temperature: 0.2, maxTokens: 2000 })
  const parsed = parseResult(raw)
  let graph = finish(parsed?.graph ?? { nodes: [], edges: [] })
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
      const fixed = finish(fixParsed.graph)
      const fixedErrs = validateGraph({ nodes: fixed.nodes as GraphNode[], edges: fixed.edges })
      if (fixedErrs.length < validation.length) {
        raw = fix; graph = fixed; clarifications = fixParsed.clarifications; validation = fixedErrs
      }
    }
  }

  return { graph, validation, valid: validation.length === 0, clarifications, raw }
}
