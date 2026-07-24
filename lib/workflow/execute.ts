import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph } from '@/lib/workflow/validate'
import { retrieveSegments } from '@/lib/kb/rag'
import { resolveExpr, coerce, type VarPool } from '@/lib/workflow/variables'
import { getAgentForChat } from '@/lib/data/agents'
import type { RequestContext } from '@/lib/context'

// 最小执行引擎（4.4.3）：拓扑串行执行 2-3 种节点（start / llm / end）。
// Tool/Skill 等节点属 4.4.2（硬等 C 道 Skill 发布），本引擎标记为 skipped、透传输入。

export type NodeTrace = {
  nodeId: string
  type: string
  status: 'succeeded' | 'failed' | 'skipped'
  input?: string
  output?: string
  error?: string
  ms: number
}
export type ExecResult = {
  status: 'succeeded' | 'failed'
  output: string
  traces: NodeTrace[]
}

type GNode = { id: string; type: string; data?: { config?: Record<string, unknown>; label?: string } }
type GEdge = { source: string; target: string; sourceHandle?: string }

const SUPPORTED = new Set(['start', 'end', 'llm', 'template-transform', 'parameter-extractor', 'knowledge-retrieval', 'http-request', 'if-else', 'variable-assigner', 'variable-aggregator', 'list-operator', 'agent'])

// 执行选项：ctx 用于需租户隔离的节点（知识检索）。
export type ExecOptions = { ctx?: RequestContext }

// SSRF 防护：只允许 http/https，拦截 localhost / 私有网段 / 云元数据地址（字面量层，残留 DNS 重绑定风险已知）。
const PRIVATE_HOST_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|fe80:|fc00:|fd00:|172\.(1[6-9]|2\d|3[01])\.)/i
function assertSafeHttpUrl(raw: string): URL {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('URL 非法') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('仅允许 http/https')
  if (PRIVATE_HOST_RE.test(u.hostname)) throw new Error('禁止访问内网/本机/元数据地址')
  return u
}

// 模板转换：把 config.template 里的 {{input}} 替换为节点输入（当前引擎单值模型）。
function renderTemplate(cfg: Record<string, unknown>, input: string): string {
  const tmpl = typeof cfg.template === 'string' ? cfg.template : ''
  if (!tmpl) return input
  return tmpl.replace(/\{\{\s*input\s*\}\}/g, input)
}

// 参数提取：让 LLM 从输入中提取 config.parameters 声明的字段，输出 JSON 字符串。
function buildExtractPrompt(cfg: Record<string, unknown>, input: string): string {
  const params = Array.isArray(cfg.parameters) ? (cfg.parameters as Array<Record<string, unknown>>) : []
  const fields = params
    .map((p) => `- ${String(p.name ?? '')}${p.description ? `（${String(p.description)}）` : ''}`)
    .filter((s) => s.trim() !== '-')
    .join('\n')
  const spec = fields || '- result（从输入中提取的关键信息）'
  return `从下面的输入中提取以下字段，严格输出 JSON（无代码块围栏、无多余文字），提取不到的填 null：\n${spec}\n\n输入：\n${input}`
}

// ── if-else 条件分支（4.4.8a）───────────────────────────────────────────
// 当前引擎为单值模型（无命名变量系统），条件对【节点输入】求值；value 为比较操作数。
// operator 取 ComparisonOperator 的字符串值（与前端 node-types.ts 枚举一致）。
function evalCondition(input: string, operator: string, rawValue: unknown): boolean {
  const v = rawValue == null ? '' : String(rawValue)
  const inNum = Number(input)
  const vNum = Number(v)
  const numOk = !Number.isNaN(inNum) && !Number.isNaN(vNum)
  switch (operator) {
    case 'contains': return input.includes(v)
    case 'not-contains': return !input.includes(v)
    case 'starts-with': return input.startsWith(v)
    case 'ends-with': return input.endsWith(v)
    case 'is': case '=': return input === v
    case 'is-not': case '!=': return input !== v
    case 'empty': case 'not-exists': return input === ''
    case 'not-empty': case 'exists': return input !== ''
    case '>': return numOk && inNum > vNum
    case '>=': return numOk && inNum >= vNum
    case '<': return numOk && inNum < vNum
    case '<=': return numOk && inNum <= vNum
    case 'in': return v.split(',').map((s) => s.trim()).includes(input)
    case 'not-in': return !v.split(',').map((s) => s.trim()).includes(input)
    default: return false
  }
}

type CondLike = { variable?: unknown; operator?: unknown; value?: unknown }
type GroupLike = { logicalOperator?: unknown; conditions?: CondLike[] }
type CaseLike = { caseId?: unknown; logicalOperator?: unknown; conditions?: GroupLike[] }

// ADR-012：条件的操作数 = 变量选择器（ValueSelector=string[]）经变量池解析所得值。
// 解析不出（无选择器 / 路径不存在）→ 返回 undefined，由调用方回退到"节点输入"（零回归）。
function resolveSelector(sel: unknown, pool: VarPool): string | undefined {
  if (!Array.isArray(sel) || sel.length === 0) return undefined
  const parts = sel.map((p) => String(p))
  if (parts[0] === 'sys' && parts[1] === 'query') return pool.sysQuery
  const dotted = parts.join('.')
  if (Object.prototype.hasOwnProperty.call(pool.vars, dotted)) return String(pool.vars[dotted])
  if (Object.prototype.hasOwnProperty.call(pool.vars, parts[0])) return String(pool.vars[parts[0]])
  if (pool.outputs.has(parts[0])) return pool.outputs.get(parts[0])
  return undefined
}

function evalGroup(group: GroupLike, input: string, pool: VarPool): boolean {
  const conds = Array.isArray(group?.conditions) ? group.conditions : []
  if (conds.length === 0) return true // 空条件组视为真
  const rs = conds.map((c) => {
    const operand = resolveSelector(c?.variable, pool) ?? input // 变量解析不出→回退节点输入
    return evalCondition(operand, String(c?.operator ?? ''), c?.value)
  })
  return group?.logicalOperator === 'or' ? rs.some(Boolean) : rs.every(Boolean)
}

function evalCase(caseItem: CaseLike, input: string, pool: VarPool): boolean {
  const groups = Array.isArray(caseItem?.conditions) ? caseItem.conditions : []
  if (groups.length === 0) return false // 无条件（else 不走此函数）→ 不匹配
  const rs = groups.map((g) => evalGroup(g, input, pool))
  return caseItem?.logicalOperator === 'or' ? rs.some(Boolean) : rs.every(Boolean)
}

function caseOrder(caseId: unknown): number {
  if (caseId === 'if-true') return 0
  const m = /^elif-(\d+)$/.exec(String(caseId ?? ''))
  return m ? Number(m[1]) : 999
}

/** 解析 if-else 命中的分支：按 if-true→elif-N 顺序取首个满足条件者，皆不中则 'else'。 */
function resolveIfElseCase(cfg: Record<string, unknown>, input: string, pool: VarPool): string {
  const cases = (Array.isArray(cfg.cases) ? cfg.cases : []) as CaseLike[]
  const ordered = [...cases].sort((a, b) => caseOrder(a?.caseId) - caseOrder(b?.caseId))
  for (const c of ordered) {
    if (String(c?.caseId) === 'else') continue
    if (evalCase(c, input, pool)) return String(c.caseId)
  }
  return 'else'
}

// ── ADR-012 变量节点执行器 ────────────────────────────────────────────────
type ListRecord = Record<string, unknown>
const pickField = (item: unknown, field: string): unknown =>
  field && item != null && typeof item === 'object' ? (item as ListRecord)[field] : item
// 数值优先比较，退化到字符串比较
const cmpValues = (x: unknown, y: unknown): number => {
  const nx = Number(x)
  const ny = Number(y)
  if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny
  const sx = String(x)
  const sy = String(y)
  return sx < sy ? -1 : sx > sy ? 1 : 0
}

/** variable-assigner：对每个 assignment 按 operation 改 pool.vars[targetVariable]。 */
function runVariableAssigner(cfg: Record<string, unknown>, pool: VarPool): void {
  const assignments = Array.isArray(cfg.assignments) ? (cfg.assignments as ListRecord[]) : []
  for (const a of assignments) {
    const target = String(a?.targetVariable ?? '')
    if (!target) continue
    const type = String(a?.targetType ?? 'string')
    const op = String(a?.operation ?? 'set')
    const src = resolveExpr(String(a?.sourceExpression ?? ''), pool)
    const prev = pool.vars[target]
    switch (op) {
      case 'append':
        if (Array.isArray(prev)) pool.vars[target] = [...prev, src]
        else pool.vars[target] = String(prev ?? '') + String(src ?? '')
        break
      case 'increment':
        pool.vars[target] = Number(prev || 0) + Number(src)
        break
      case 'decrement':
        pool.vars[target] = Number(prev || 0) - Number(src)
        break
      case 'toggle':
        pool.vars[target] = !Boolean(prev)
        break
      case 'set':
      default:
        pool.vars[target] = coerce(src, type)
        break
    }
  }
}

/** variable-aggregator：收集 sources 各值成数组（object 类型则按 alias 收成对象），写入 pool 并返回 JSON 串。 */
function runVariableAggregator(cfg: Record<string, unknown>, pool: VarPool): string {
  const srcs = (Array.isArray(cfg.sources)
    ? cfg.sources
    : Array.isArray(cfg.variables)
      ? cfg.variables
      : []) as ListRecord[]
  const collected = srcs.map((s) => resolveExpr(String(s?.variable ?? s?.selector ?? ''), pool))
  const outVar = String(cfg.outputVariable ?? '')
  const outType = String(cfg.outputType ?? 'array').toLowerCase()
  let aggregated: unknown = collected
  if (outType === 'object') {
    const obj: Record<string, unknown> = {}
    srcs.forEach((s, i) => {
      obj[String(s?.alias ?? s?.variable ?? i)] = collected[i]
    })
    aggregated = obj
  }
  if (outVar) pool.vars[outVar] = aggregated
  return JSON.stringify(aggregated)
}

type ListOpResult = { out: string; note?: string }
/** list-operator：对节点输入(JSON 数组)做列表操作。filter/map/reduce/find 需表达式引擎，v1 透传并标注。 */
function runListOperator(cfg: Record<string, unknown>, input: string): ListOpResult {
  let arr: unknown[]
  try {
    const parsed = JSON.parse(input)
    arr = Array.isArray(parsed) ? parsed : []
  } catch {
    arr = []
  }
  const op = String(cfg.operation ?? '')
  if (op === 'filter' || op === 'map' || op === 'reduce' || op === 'find') {
    return { out: input, note: `列表操作「${op}」需表达式引擎(暂不支持)` }
  }
  let result: unknown = arr
  switch (op) {
    case 'sort': {
      const field = cfg.sortField ? String(cfg.sortField) : ''
      const sorted = [...arr].sort((a, b) => cmpValues(pickField(a, field), pickField(b, field)))
      if (String(cfg.sortOrder ?? 'asc') === 'desc') sorted.reverse()
      result = sorted
      break
    }
    case 'slice': {
      const start = Number(cfg.sliceStart ?? 0) || 0
      const end = cfg.sliceEnd == null || cfg.sliceEnd === '' ? undefined : Number(cfg.sliceEnd)
      result = arr.slice(start, end)
      break
    }
    case 'reverse':
      result = [...arr].reverse()
      break
    case 'unique': {
      const seen = new Set<string>()
      const uniq: unknown[] = []
      for (const item of arr) {
        const key = item != null && typeof item === 'object' ? JSON.stringify(item) : String(item)
        if (!seen.has(key)) {
          seen.add(key)
          uniq.push(item)
        }
      }
      result = uniq
      break
    }
    case 'flatten':
      result = arr.reduce<unknown[]>((acc, it) => acc.concat(Array.isArray(it) ? it : [it]), [])
      break
    case 'group': {
      const field = String(cfg.groupByField ?? '')
      const groups: Record<string, unknown[]> = {}
      for (const item of arr) {
        const k = String(pickField(item, field))
        ;(groups[k] ??= []).push(item)
      }
      result = groups
      break
    }
    default:
      result = arr
      break
  }
  return { out: JSON.stringify(result) }
}

/** 拓扑排序（Kahn）；有环则回退到原始顺序（校验已拦环，这里稳妥兜底）。 */
function topoOrder(nodes: GNode[], edges: GEdge[]): GNode[] {
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (adj.has(e.source) && indeg.has(e.target)) {
      adj.get(e.source)!.push(e.target)
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
    }
  }
  const q = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: GNode[] = []
  while (q.length) {
    const id = q.shift()!
    const node = byId.get(id)
    if (node) out.push(node)
    for (const v of adj.get(id) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1)
      if ((indeg.get(v) ?? 0) === 0) q.push(v)
    }
  }
  return out.length === nodes.length ? out : nodes
}

/**
 * 执行工作流图。input 为起始输入；各节点输入=其前驱输出拼接（无前驱=运行输入）。
 * LLM 节点：prompt 取 config.prompt（可含 {{input}} 占位），否则默认基于输入处理。
 */
export async function executeGraph(graph: WorkflowGraph, input: string, opts: ExecOptions = {}): Promise<ExecResult> {
  const errs = validateGraph(graph)
  if (errs.length > 0) {
    return { status: 'failed', output: '', traces: [{ nodeId: '-', type: '-', status: 'failed', error: `图非法：${errs.map((e) => e.message).join('；')}`, ms: 0 }] }
  }

  const nodes = (graph.nodes ?? []) as GNode[]
  const edges = (graph.edges ?? []) as GEdge[]
  const preds = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) if (preds.has(e.target)) preds.get(e.target)!.push(e.source)

  const outputs = new Map<string, string>()
  // ADR-012 P1：运行期变量池（vars 空起步，outputs 复用节点输出 Map，sysQuery=运行输入）
  const pool: VarPool = { vars: {}, outputs, sysQuery: input }
  const traces: NodeTrace[] = []
  const ordered = topoOrder(nodes, edges)

  // 出边（含 sourceHandle）：用于 if-else 分支路由
  const outEdges = new Map<string, GEdge[]>(nodes.map((n) => [n.id, []]))
  for (const e of edges) if (outEdges.has(e.source)) outEdges.get(e.source)!.push(e)

  // 可达集：入度 0 的入口节点先可达；每个已执行节点沿"命中"的出边把目标标记可达。
  // if-else 仅命中分支（sourceHandle===activeCase）的边生效；其它节点全部出边生效。
  // 分支未走到的节点不执行、不记 trace（traces = 实际执行路径）。
  const reachable = new Set<string>(nodes.filter((n) => (preds.get(n.id)?.length ?? 0) === 0).map((n) => n.id))
  const propagate = (nodeId: string, activeCase: string | null) => {
    for (const e of outEdges.get(nodeId) ?? []) {
      const taken = activeCase !== null ? (e.sourceHandle ?? '') === activeCase : true
      if (taken) reachable.add(e.target)
    }
  }

  const inputOf = (n: GNode): string => {
    const ps = preds.get(n.id) ?? []
    if (ps.length === 0) return input
    return ps.map((p) => outputs.get(p) ?? '').filter(Boolean).join('\n')
  }

  for (const n of ordered) {
    if (!reachable.has(n.id)) continue // 分支未命中：跳过，不执行、不记 trace
    const t0 = Date.now()
    const nodeInput = inputOf(n)
    let activeCase: string | null = null // 仅 if-else 设值：命中分支的 caseId
    let noteError: string | undefined = undefined // 节点级软标注（如列表操作暂不支持），status 仍 succeeded
    try {
      if (!SUPPORTED.has(n.type)) {
        // Tool/Skill 等节点：4.4.2 未就绪，跳过并透传
        outputs.set(n.id, nodeInput)
        traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '该节点类型需 4.4.2/Skill 支持（暂跳过）', ms: Date.now() - t0 })
        propagate(n.id, activeCase)
        continue
      }
      let out = nodeInput
      const cfg = n.data?.config ?? {}
      if (n.type === 'llm') {
        const tmpl = typeof cfg.prompt === 'string' && cfg.prompt.trim() ? String(cfg.prompt) : '请根据以下输入给出简洁回复：\n{{input}}'
        const prompt = tmpl.includes('{{input}}') ? tmpl.replace(/\{\{input\}\}/g, nodeInput) : `${tmpl}\n\n输入：${nodeInput}`
        out = await chat([{ role: 'user', content: prompt }])
      } else if (n.type === 'template-transform') {
        out = renderTemplate(cfg, nodeInput)
      } else if (n.type === 'parameter-extractor') {
        out = await chat([{ role: 'user', content: buildExtractPrompt(cfg, nodeInput) }])
      } else if (n.type === 'if-else') {
        // 条件分支：透传输入，另定命中分支（activeCase）→ 只放行对应 sourceHandle 的出边
        // ADR-012：条件先经变量池解析选择器，解析不出回退"对节点输入求值"（零回归）
        activeCase = resolveIfElseCase(cfg, nodeInput, pool)
        out = nodeInput
      } else if (n.type === 'variable-assigner') {
        // 变量赋值：改写 pool.vars；节点输出透传输入以保持线性链
        runVariableAssigner(cfg, pool)
        out = nodeInput
      } else if (n.type === 'variable-aggregator') {
        // 变量聚合：收集多变量成数组/对象写回 pool，节点输出=聚合值 JSON
        out = runVariableAggregator(cfg, pool)
      } else if (n.type === 'list-operator') {
        // 列表操作：对输入 JSON 数组做 sort/slice/reverse/unique/flatten/group；表达式类操作暂标注透传
        const r = runListOperator(cfg, nodeInput)
        out = r.out
        noteError = r.note
      } else if (n.type === 'knowledge-retrieval') {
        // 知识检索：真实 RAG（retrieveSegments），query=节点输入；无 ctx 则跳过透传。
        if (!opts.ctx) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '缺少运行上下文（ctx），无法检索', ms: Date.now() - t0 })
          propagate(n.id, activeCase)
          continue
        }
        const kbId = Array.isArray(cfg.dataset_ids) && cfg.dataset_ids.length > 0 ? String(cfg.dataset_ids[0]) : undefined
        const segs = await retrieveSegments(opts.ctx, nodeInput, { kbId, topK: 5 })
        out = segs.length
          ? segs.map((s, i) => `[${i + 1}] 《${s.filename}》：${s.snippet}`).join('\n')
          : '（未检索到相关内容）'
      } else if (n.type === 'http-request') {
        // HTTP 请求：SSRF 防护 + 15s 超时；输出响应体（截断 4000 字）。
        const url = assertSafeHttpUrl(String(cfg.url ?? '').replace(/\{\{\s*input\s*\}\}/g, encodeURIComponent(nodeInput)))
        const method = String(cfg.method ?? 'GET').toUpperCase()
        const headers = cfg.headers && typeof cfg.headers === 'object' ? (cfg.headers as Record<string, string>) : undefined
        const res = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' && method !== 'HEAD' && typeof cfg.body === 'string' ? cfg.body : undefined,
          signal: AbortSignal.timeout(15000),
        })
        const text = await res.text()
        out = `HTTP ${res.status}\n${text.slice(0, 4000)}`
      } else if (n.type === 'agent') {
        // 4.1.10：Agent 节点——引用已发布平台 Agent，用其人设 LLM 处理节点输入。
        // （一个 workflow 可由多个 Agent 节点组成；不递归执行被引用 Agent 的大脑工作流，避免环，防环在绑定时已拦。）
        if (!opts.ctx) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '缺少运行上下文（ctx）', ms: Date.now() - t0 })
          propagate(n.id, activeCase)
          continue
        }
        const agentId = typeof cfg.agentId === 'string' ? cfg.agentId : ''
        if (!agentId) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: 'Agent 节点未指定引用的 Agent', ms: Date.now() - t0 })
          propagate(n.id, activeCase)
          continue
        }
        const ag = await getAgentForChat(opts.ctx, agentId)
        if (!ag) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '引用的 Agent 不存在或无权访问', ms: Date.now() - t0 })
          propagate(n.id, activeCase)
          continue
        }
        const sys = ag.systemPrompt?.trim() || `你是数字员工「${ag.name}」，围绕职责用简洁专业的中文处理输入。`
        out = await chat([{ role: 'system', content: sys }, { role: 'user', content: nodeInput }], { model: ag.model, temperature: ag.temperature })
      }
      // start / end：透传（start 输出=运行输入；end 输出=其输入=最终结果）
      outputs.set(n.id, out)
      traces.push({ nodeId: n.id, type: n.type, status: 'succeeded', input: nodeInput, output: n.type === 'if-else' ? `分支命中：${activeCase}` : out, error: noteError, ms: Date.now() - t0 })
    } catch (e) {
      traces.push({ nodeId: n.id, type: n.type, status: 'failed', input: nodeInput, error: String(e instanceof Error ? e.message : e), ms: Date.now() - t0 })
      return { status: 'failed', output: '', traces }
    }
    propagate(n.id, activeCase)
  }

  // 最终输出 = 已执行(可达)的 end 节点输出（无 end 则取最后一个已执行节点）
  const endNode =
    [...ordered].reverse().find((n) => n.type === 'end' && outputs.has(n.id)) ??
    [...ordered].reverse().find((n) => outputs.has(n.id))
  return { status: 'succeeded', output: endNode ? (outputs.get(endNode.id) ?? '') : '', traces }
}
