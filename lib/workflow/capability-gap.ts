// 能力缺口分析 + find-skill（WF-17）：AI 生成的流程「差什么能力」，以及「上哪儿补」。
//
// 🔴 为什么不做「联网自动找并安装」：用户最初要的是这个，但
//   ① 平台没有外部 Skill 源可拉，所谓联网找实际是让模型搜网页再生成配置——
//      产物不可信、不可复现，与刚修掉的「编造假 URL」是同一类病，危害更大；
//   ② 自动把外部代码装进企业租户是典型供应链攻击面，会绕过 SEC-1/2/3 上架审核
//      与 ADR-005「AI 只产 draft、不发布」的铁律。
// 所以这里只做**发现 + 起草**：在已有资产里找候选，找不到就起草一份 draft，
// 安装与发布始终是人点的。自动化收益基本拿全，风险留在门外。
//
// 纯函数、零依赖、可单测；不调模型、不发请求。

export type GapKind =
  | 'capability'  // 缺一项真实能力（如联网检索）——节点在假装干活
  | 'endpoint'    // 缺接口地址（http 节点的 URL 被判为占位后清空）
  | 'binding'     // tool 节点没绑到具体 Skill

export type CapabilityGap = {
  kind: GapKind
  nodeId: string
  nodeLabel: string
  /** 缺的东西，用于检索候选与起草 Skill，如「联网检索」 */
  need: string
  /** 给用户看的一句话 */
  message: string
}

export type CandidateSource = 'skill' | 'mcp'
export type Candidate = {
  source: CandidateSource
  id: string
  name: string
  description: string
  /** skill 才有：published 的可直接用，draft 的需先走审核 */
  status?: string
  /** 匹配得分，仅用于排序 */
  score: number
}

export type GapResolution = {
  gap: CapabilityGap
  candidates: Candidate[]
  /** 无候选时建议起草一个新 Skill */
  suggestDraft: boolean
}

type LooseNode = { id: string; type: string; data?: { label?: string; config?: Record<string, unknown> } }
type LooseGraph = { nodes?: LooseNode[] }

/**
 * 从 label 里抽出真正缺的能力名，用作检索词与起草输入。
 *
 * 两种形态要分开处理，否则会抽出「能力，请手动挂载」这种垃圾检索词：
 *   ①「抓取AI大事件（需接入**实时网络检索**能力）」—— 能力名在括号里
 *   ②「**联网检索**（需接入能力，请手动挂载）」—— 括号是通用降级标记，能力名在括号前
 */
export function extractNeed(label: string): string {
  const t = label.trim()
  const paren = /[（(]([^）)]*)[）)]\s*$/.exec(t)
  const stem = t.replace(/[（(][^）)]*[）)]\s*$/, '').trim()
  if (paren) {
    // 括号内必须是干净的「需接入 XX 能力」才取它；带标点的说明性文字一律不取
    const m = /^需接入\s*([^，,。；;]+?)(?:能力)?$/.exec(paren[1].trim())
    if (m?.[1]) return m[1].trim()
    return stem || t
  }
  const inline = /需接入\s*([^，,。；;]+?)(?:能力)?$/.exec(t)
  if (inline?.[1]) return inline[1].trim()
  return stem || t
}

/** 找出这张图差哪些能力。只认确定性信号，不猜。 */
export function findCapabilityGaps(graph: LooseGraph): CapabilityGap[] {
  const gaps: CapabilityGap[] = []
  for (const n of graph?.nodes ?? []) {
    const label = n.data?.label ?? n.type
    const cfg = n.data?.config ?? {}

    if (n.type === 'llm' && /需接入|需人工挂载/.test(label)) {
      gaps.push({
        kind: 'capability', nodeId: n.id, nodeLabel: label, need: extractNeed(label),
        message: `「${label}」这一步没有真实能力支撑，跑起来是模型编的`,
      })
    }
    if (n.type === 'http-request' && !String(cfg.url ?? '').trim()) {
      gaps.push({
        kind: 'endpoint', nodeId: n.id, nodeLabel: label, need: extractNeed(label),
        message: `「${label}」缺接口地址，需要填真实可用的 API 或改挂 Skill`,
      })
    }
    if (n.type === 'tool' && !String(cfg.tool_id ?? '').trim()) {
      gaps.push({
        kind: 'binding', nodeId: n.id, nodeLabel: label, need: extractNeed(label),
        message: `「${label}」未绑定具体能力`,
      })
    }
  }
  return gaps
}

// ── find-skill：在已有资产里找候选 ─────────────────────────────────────

/** 中文没有空格分词，退化为 2-gram + 英文单词，够用且完全确定 */
function tokenize(s: string): string[] {
  const text = s.toLowerCase()
  const words = text.match(/[a-z0-9]+/g) ?? []
  const cjk = text.replace(/[^一-龥]/g, '')
  const grams: string[] = []
  for (let i = 0; i < cjk.length - 1; i++) grams.push(cjk.slice(i, i + 2))
  if (cjk.length === 1) grams.push(cjk)
  return [...words, ...grams]
}

/** 重合度打分：命中越多、候选描述越短（越聚焦）得分越高 */
function score(need: string, text: string): number {
  const a = new Set(tokenize(need))
  const b = tokenize(text)
  if (a.size === 0 || b.length === 0) return 0
  const hit = b.filter((t) => a.has(t)).length
  return hit === 0 ? 0 : hit / Math.sqrt(b.length)
}

export type SkillLike = { id: string; name: string; description?: string | null; status?: string | null; type?: string | null }
export type McpLike = { id: string; name: string; description?: string | null }

const MIN_SCORE = 0.25

/**
 * 为每个缺口找候选。
 *
 * 只在**本租户已有资产**里找：已发布/草稿 Skill、已配置的 MCP Server。
 * 找不到不硬凑——宁可建议起草一个新的，也不要推荐一个不相干的 Skill
 * 让用户挂上去，那会变成新的「看着配好了其实不对」。
 */
export function resolveGaps(
  gaps: CapabilityGap[],
  assets: { skills: SkillLike[]; mcpServers: McpLike[] },
): GapResolution[] {
  return gaps.map((gap) => {
    const fromSkills: Candidate[] = assets.skills
      .map((s) => ({
        source: 'skill' as const, id: s.id, name: s.name,
        description: s.description ?? '',
        status: s.status ?? undefined,
        score: Math.max(score(gap.need, s.name), score(gap.need, s.description ?? '')),
      }))
      .filter((c) => c.score >= MIN_SCORE)

    const fromMcp: Candidate[] = assets.mcpServers
      .map((m) => ({
        source: 'mcp' as const, id: m.id, name: m.name,
        description: m.description ?? '',
        score: Math.max(score(gap.need, m.name), score(gap.need, m.description ?? '')),
      }))
      .filter((c) => c.score >= MIN_SCORE)

    const candidates = [...fromSkills, ...fromMcp]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return { gap, candidates, suggestDraft: candidates.length === 0 }
  })
}
