// 工作流「可用性体检」（WF-11）：图结构合法 ≠ 跑得起来。
//
// 🔴 为什么单靠 validateGraph 不够：它只看拓扑（有没有 start/end、连不连通、有没有环）。
// 用户实测遇到的是另一类问题——图完全合法，但
//   · LLM 节点没有提示词，跑起来是模型自由发挥；
//   · HTTP 节点填的是 `https://api.example-search.com/v1/search` 这种**编造的假 URL**，一跑就 404；
//   · tool 节点没挂到真实 Skill。
// 这些流程「看着完整、发布出去就是坏的」，所以自动生成后先体检，
// 未通过就不让发布（发布是人工动作，但门槛由机器把）。
//
// 体检是**纯静态**的：不调大模型、不发请求、零成本、无副作用。

import type { WorkflowGraph } from '@/lib/workflow/validate'

export type ReadinessLevel = 'error' | 'warn'
export type ReadinessIssue = {
  level: ReadinessLevel
  code: string
  nodeId?: string
  nodeLabel?: string
  message: string
}
export type ReadinessReport = {
  ready: boolean          // 无 error 即可发布（warn 只提示）
  issues: ReadinessIssue[]
  checked: number         // 体检覆盖的节点数
}

type LooseNode = {
  id: string
  type: string
  data?: { label?: string; config?: Record<string, unknown> }
}

/**
 * 占位/示例域名识别。模型编 URL 时高度集中在这几种写法上，
 * 逐个列举比「猜哪些域名是真的」可靠——放过一个假 URL 的代价是线上 404。
 */
const PLACEHOLDER_URL_RE = /(example\.(com|org|net)|example-|\bexample\b|your-?(api|domain|host)|api\.your|placeholder|todo|xxx+|<[^>]+>|\{\{?\s*(url|endpoint)\s*\}?\})/i

/** URL 是否可用：必须是 http(s) 绝对地址，且不含占位痕迹 */
export function isUsableUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (PLACEHOLDER_URL_RE.test(u)) return false
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 「这一步要拿外部数据」的动词表（WF-21）。
 *
 * 🔴 为什么要确定性词表而不是靠模型自觉：生成规则里写了「没有对应能力就在 label 注明
 * 需接入 XX 能力」，实测模型经常不照做——用户那条「查全网当天 AI 大事件」生成出来的是
 * 一个干干净净的 llm 节点「抓取前一日的AI大事件」，没有任何标记。跑起来模型无从检索，
 * 只能编，或者写一长篇「我无法联网」的自白当作最终输出。
 * 光靠提示词压不住的，就必须用代码拦。
 */
const EXTERNAL_DATA_RE =
  /抓取|爬取|检索|搜索|搜集|收集|查找|采集|获取(?:最新|当天|今日|昨日|实时)|联网|全网|实时(?:数据|资讯|新闻)|最新(?:资讯|新闻|动态|消息)|新闻源|舆情/

/** 能把外部数据带进流程的节点类型——只要有一个，就说明数据有正经来源 */
const EXTERNAL_SOURCE_TYPES = new Set(['tool', 'http-request', 'knowledge-retrieval', 'agent', 'sub-workflow', 'code'])

/** LLM 提示词：面板 prompts[] 优先，回落引擎侧 prompt（与 execute.ts 的取法一致） */
function llmPromptOf(cfg: Record<string, unknown>): string {
  const prompts = Array.isArray(cfg.prompts) ? (cfg.prompts as Record<string, unknown>[]) : []
  const fromPanel = prompts
    .filter((p) => typeof p?.text === 'string' && String(p.text).trim())
    .map((p) => String(p.text).trim())
    .join('\n\n')
  if (fromPanel) return fromPanel
  return typeof cfg.prompt === 'string' ? cfg.prompt.trim() : ''
}

/**
 * 体检一张图。error = 发布拦截项，warn = 提示但放行。
 *
 * 判定尺度的取舍：**能确定跑不通的才算 error**。
 * 把「可能有问题」也判成 error 会让用户被挡在发布门外却不知道改什么，
 * 那比不检查更烦人。
 */
export function checkReadiness(graph: WorkflowGraph): ReadinessReport {
  const nodes = (graph?.nodes ?? []) as LooseNode[]
  const issues: ReadinessIssue[] = []
  const push = (level: ReadinessLevel, code: string, n: LooseNode, message: string) =>
    issues.push({ level, code, nodeId: n.id, nodeLabel: n.data?.label ?? n.type, message })

  // 整张图有没有正经的外部数据入口。没有的话，任何声称「抓取/检索」的步骤都只能是编的。
  // 判据放在图这一级而不是节点级：llm 节点叫「整理抓取到的资讯」很正常——
  // 只要上游真有 tool/http 把数据取进来，就不该报错。
  const hasExternalSource = nodes.some((n) => EXTERNAL_SOURCE_TYPES.has(n.type))

  for (const n of nodes) {
    const cfg = n.data?.config ?? {}

    if (n.type === 'llm') {
      const prompt = llmPromptOf(cfg)
      // WF-21：说要联网取数、全图却没有任何外部数据来源 → 拦住，别让它跑出一篇编的
      if (!hasExternalSource && EXTERNAL_DATA_RE.test(`${n.data?.label ?? ''}\n${prompt}`)) {
        push('error', 'llm_no_data_source', n,
          '这一步要拿外部数据（抓取/检索/搜索），但整条流程没有任何联网或数据源能力——' +
          '直接跑只会得到模型编造的内容。请挂上具备联网检索能力的 Skill，或改用 HTTP 请求节点接真实接口')
      }
      if (!prompt) {
        push('error', 'llm_no_prompt', n, '未设置提示词，运行时会退化成模型自由发挥')
      } else if (prompt.length < 10) {
        push('warn', 'llm_thin_prompt', n, '提示词过短，产出可能不稳定')
      }
      if (!cfg.model || typeof cfg.model !== 'object') {
        push('warn', 'llm_no_model', n, '未指定模型，将使用系统默认模型')
      }
      // 「需接入 XX 能力」是生成时的降级标记：这类节点其实没有对应能力
      if ((n.data?.label ?? '').includes('需接入')) {
        push('error', 'llm_placeholder_capability', n, '该步骤缺少真实能力（生成时已标注需人工挂载），请挂上对应 Skill 或改写流程')
      }
    }

    if (n.type === 'http-request') {
      const url = typeof cfg.url === 'string' ? cfg.url : ''
      if (!url) push('error', 'http_no_url', n, '未填写请求地址')
      else if (!isUsableUrl(url)) push('error', 'http_placeholder_url', n, `请求地址是占位/示例地址（${url}），跑起来必然失败，请换成真实可用的接口`)
    }

    if (n.type === 'tool') {
      const toolId = typeof cfg.tool_id === 'string' ? cfg.tool_id : ''
      if (!toolId) push('error', 'tool_unbound', n, '未绑定具体能力（Skill）')
    }

    if (n.type === 'if-else') {
      const cases = Array.isArray(cfg.cases) ? (cfg.cases as Record<string, unknown>[]) : []
      const hasCondition = cases.some((c) => Array.isArray(c?.conditions) && (c.conditions as unknown[]).length > 0)
      if (!hasCondition) {
        // 空条件在引擎里恒不命中 → 永远走 else，等于分支没生效
        push('error', 'ifelse_no_condition', n, '判断条件为空，运行时会永远走 ELSE 分支，请补上条件')
      }
    }

    if (n.type === 'knowledge-retrieval') {
      const ids = Array.isArray(cfg.dataset_ids) ? cfg.dataset_ids : []
      if (ids.length === 0) push('error', 'kb_unbound', n, '未选择知识库')
    }
  }

  return { ready: !issues.some((i) => i.level === 'error'), issues, checked: nodes.length }
}

/** 一行摘要，用于 Copilot 对话与 toast */
export function summarizeReadiness(r: ReadinessReport): string {
  const errors = r.issues.filter((i) => i.level === 'error').length
  const warns = r.issues.length - errors
  if (r.ready && warns === 0) return `✅ 自动体检通过（${r.checked} 个节点）`
  if (r.ready) return `✅ 自动体检通过（${r.checked} 个节点）· ${warns} 项提示`
  return `⚠️ 自动体检未通过：${errors} 项必须处理${warns ? `、${warns} 项提示` : ''}，处理完才能发布`
}
