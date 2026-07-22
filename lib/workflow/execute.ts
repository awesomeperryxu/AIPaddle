import 'server-only'
import { chat } from '@/lib/ai'
import { validateGraph, type WorkflowGraph } from '@/lib/workflow/validate'
import { retrieveSegments } from '@/lib/kb/rag'
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
type GEdge = { source: string; target: string }

const SUPPORTED = new Set(['start', 'end', 'llm', 'template-transform', 'parameter-extractor', 'knowledge-retrieval', 'http-request', 'agent'])

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
  const traces: NodeTrace[] = []
  const ordered = topoOrder(nodes, edges)

  const inputOf = (n: GNode): string => {
    const ps = preds.get(n.id) ?? []
    if (ps.length === 0) return input
    return ps.map((p) => outputs.get(p) ?? '').filter(Boolean).join('\n')
  }

  for (const n of ordered) {
    const t0 = Date.now()
    const nodeInput = inputOf(n)
    try {
      if (!SUPPORTED.has(n.type)) {
        // Tool/Skill 等节点：4.4.2 未就绪，跳过并透传
        outputs.set(n.id, nodeInput)
        traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '该节点类型需 4.4.2/Skill 支持（暂跳过）', ms: Date.now() - t0 })
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
      } else if (n.type === 'knowledge-retrieval') {
        // 知识检索：真实 RAG（retrieveSegments），query=节点输入；无 ctx 则跳过透传。
        if (!opts.ctx) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '缺少运行上下文（ctx），无法检索', ms: Date.now() - t0 })
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
          continue
        }
        const agentId = typeof cfg.agentId === 'string' ? cfg.agentId : ''
        if (!agentId) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: 'Agent 节点未指定引用的 Agent', ms: Date.now() - t0 })
          continue
        }
        const ag = await getAgentForChat(opts.ctx, agentId)
        if (!ag) {
          outputs.set(n.id, nodeInput)
          traces.push({ nodeId: n.id, type: n.type, status: 'skipped', input: nodeInput, output: nodeInput, error: '引用的 Agent 不存在或无权访问', ms: Date.now() - t0 })
          continue
        }
        const sys = ag.systemPrompt?.trim() || `你是数字员工「${ag.name}」，围绕职责用简洁专业的中文处理输入。`
        out = await chat([{ role: 'system', content: sys }, { role: 'user', content: nodeInput }], { model: ag.model, temperature: ag.temperature })
      }
      // start / end：透传（start 输出=运行输入；end 输出=其输入=最终结果）
      outputs.set(n.id, out)
      traces.push({ nodeId: n.id, type: n.type, status: 'succeeded', input: nodeInput, output: out, ms: Date.now() - t0 })
    } catch (e) {
      traces.push({ nodeId: n.id, type: n.type, status: 'failed', input: nodeInput, error: String(e instanceof Error ? e.message : e), ms: Date.now() - t0 })
      return { status: 'failed', output: '', traces }
    }
  }

  // 最终输出 = end 节点输出（无 end 则取最后一个节点）
  const endNode = ordered.filter((n) => n.type === 'end').pop() ?? ordered[ordered.length - 1]
  return { status: 'succeeded', output: endNode ? (outputs.get(endNode.id) ?? '') : '', traces }
}
