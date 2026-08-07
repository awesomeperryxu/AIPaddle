// 体检项一键修复（WF-25）：能确定怎么修的，让用户点一下就好，别逼他挨个节点翻配置。
//
// 🔴 背景：联网搜索开关（WF-22）只影响**新生成**的流程，已存库的老流程不会追溯变更。
// 用户手上那两条「查全网AI大事件」正是老代码生成的——label 带「需接入…能力」、
// 没有 enableSearch，打开就被体检拦住，而修法（去节点里翻出开关）他并不知道。
// 拦住却不给出路，等于把问题丢回给用户。
//
// 只修**能确定的**：判据与 readiness 同源，改动可逐条说明。拿不准的一律不动——
// 悄悄改错配置比拦住更糟。

import type { WorkflowGraph } from '@/lib/workflow/validate'

export type AutoFix = { nodeId: string; nodeLabel: string; action: string }
export type AutoFixResult = { graph: WorkflowGraph; fixes: AutoFix[] }

type LooseNode = {
  id: string
  type: string
  data?: { label?: string; config?: Record<string, unknown> }
}

/** 与 readiness.EXTERNAL_DATA_RE / copilot.NEEDS_WEB_RE 同源的取数动词 */
const NEEDS_WEB_RE =
  /抓取|爬取|检索|搜索|搜集|收集|查找|采集|获取(?:最新|当天|今日|昨日|实时)|联网|全网|实时(?:数据|资讯|新闻)|最新(?:资讯|新闻|动态|消息)|新闻源|舆情/

/** 生成时的降级标记，修好后要从 label 上摘掉，否则界面继续吓人 */
const PLACEHOLDER_SUFFIX_RE = /[（(]\s*需接入[^）)]*[）)]\s*$/

const promptOf = (cfg: Record<string, unknown>): string => {
  const prompts = Array.isArray(cfg.prompts) ? (cfg.prompts as Record<string, unknown>[]) : []
  const fromPanel = prompts
    .filter((p) => typeof p?.text === 'string')
    .map((p) => String(p.text))
    .join('\n')
  return `${fromPanel}\n${typeof cfg.prompt === 'string' ? cfg.prompt : ''}`
}

/**
 * 对一张图做可确定的修复，返回新图与修复清单（调用方负责落库与审计）。
 *
 * 当前只有一类：**要取外部数据的 llm 节点打开联网搜索**。
 * 顺带摘掉 label 尾部的「（需接入 XX 能力）」——能力已经有了，标记留着只会误导。
 */
export function autoFixGraph(graph: WorkflowGraph): AutoFixResult {
  const nodes = (graph?.nodes ?? []) as LooseNode[]
  const fixes: AutoFix[] = []

  const nextNodes = nodes.map((n) => {
    if (n.type !== 'llm') return n
    const cfg = n.data?.config ?? {}
    if (cfg.enableSearch === true) return n

    const label = n.data?.label ?? ''
    const needsWeb = NEEDS_WEB_RE.test(`${label}\n${promptOf(cfg)}`)
    // 只认「明说要取数」的节点。label 干净、提示词也没提检索的，不替用户做主
    if (!needsWeb) return n

    const cleanLabel = label.replace(PLACEHOLDER_SUFFIX_RE, '').trim() || label
    fixes.push({
      nodeId: n.id,
      nodeLabel: cleanLabel,
      action: '已打开联网搜索——这一步将真的联网取数，而不是凭模型记忆作答',
    })
    return { ...n, data: { ...n.data, label: cleanLabel, config: { ...cfg, enableSearch: true } } }
  })

  return { graph: { ...graph, nodes: nextNodes } as WorkflowGraph, fixes }
}
