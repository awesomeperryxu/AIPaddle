// 4.1.21 / ADR-015：数字员工群聊「谁该发言」纯函数（核心可测逻辑）。
// 两种触发：① @定向命中 → 该数字员工必选（reason='mention'，不受冷却约束）；
//          ② 主动捕捉 → 未被 @ 的数字员工，关键词/能力域命中群消息且不在冷却窗内 → 选中（reason='proactive'）。
// 纯函数：不 new Date()、不读库；now 与参与者/冷却态一律由调用方（API 层）备好并传入。
// 权限在 API 层裁定后，只把「本群有权数字员工」放进 participants。

/** 主动发言冷却窗（毫秒）：同一数字员工上次发言距今 < 此值 → 本条不主动发言。@定向不受此约束。 */
export const COOLDOWN_MS = 30_000

export type SpeakParticipant = {
  agentId: string
  /** 数字员工名称，用于 @定向 匹配（除 agentId 外的可读别名）。 */
  name: string
  /** 能力域关键词（由 name/description/能力标签在 API 层拆出）；命中即视为主动发言候选。 */
  keywords: string[]
}

/** agentId → 上次发言时间戳（毫秒）。缺失表示从未发言（不在冷却）。 */
export type CooldownState = Record<string, number>

export type SpeakDecision = { agentId: string; reason: 'mention' | 'proactive' }

/**
 * 从文本提取 @提及 token（@名字 / @id）。
 * 以 @ 起，止于空白或常见标点；返回去重后的原文 token（保留大小写，匹配时再归一）。
 */
export function parseMentions(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /@([^\s@，,。.!！?？、；;:：]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const tok = m[1].trim()
    if (!tok) continue
    const key = tok.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tok)
  }
  return out
}

/** 关键词命中：keyword（长度≥2，避免噪音）作为子串出现在消息中（大小写不敏感）。 */
function keywordHit(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase()
  return keywords.some((k) => {
    const kw = k.trim().toLowerCase()
    return kw.length >= 2 && lower.includes(kw)
  })
}

/**
 * 选出本条消息应发言的数字员工。
 * - @定向命中（token 匹配 name 或 agentId，大小写不敏感）→ 必选 reason='mention'（忽略冷却）。
 * - 其余：关键词命中且不在冷却（now - lastSpokeAt >= COOLDOWN_MS，或从未发言）→ reason='proactive'。
 * - 同一数字员工至多入选一次；@定向优先于主动。
 */
export function selectSpeakers(input: {
  message: string
  participants: SpeakParticipant[]
  cooldownState: CooldownState
  now: number
}): SpeakDecision[] {
  const { message, participants, cooldownState, now } = input
  const mentionSet = new Set(parseMentions(message).map((t) => t.toLowerCase()))
  const decisions: SpeakDecision[] = []
  const picked = new Set<string>()

  for (const p of participants) {
    if (picked.has(p.agentId)) continue
    const mentioned =
      mentionSet.has(p.agentId.toLowerCase()) || mentionSet.has(p.name.trim().toLowerCase())
    if (mentioned) {
      decisions.push({ agentId: p.agentId, reason: 'mention' })
      picked.add(p.agentId)
    }
  }

  for (const p of participants) {
    if (picked.has(p.agentId)) continue
    if (!keywordHit(message, p.keywords)) continue
    const last = cooldownState[p.agentId]
    const inCooldown = typeof last === 'number' && now - last < COOLDOWN_MS
    if (inCooldown) continue
    decisions.push({ agentId: p.agentId, reason: 'proactive' })
    picked.add(p.agentId)
  }

  return decisions
}
