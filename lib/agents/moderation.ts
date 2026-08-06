// 内容审查（v1.14 升级）：可配置敏感词 + DashScope AI 内容安全 + 输出审查。
// 三种级别：keywords（仅关键词匹配）、ai（仅 AI 语义审查）、both（双重）。

// 默认敏感词集合（平台级兜底，Agent 可在此基础上追加自定义词）
const DEFAULT_SENSITIVE_TERMS = [
  '制造炸弹', '制作炸弹', '炸弹制作', '爆炸物制作',
  '制毒', '制作毒品', '毒品交易',
  '枪支制造', '买卖枪支',
  '自杀方法', '如何自杀',
  '儿童色情', '人口贩卖',
]

export type ModerationResult = {
  flagged: boolean
  reason?: string
  source?: 'keywords' | 'ai' // 命中来源
}

export type ModerationConfig = {
  level?: 'keywords' | 'ai' | 'both'
  customKeywords?: string[]
}

/** 关键词匹配审查 */
function checkKeywords(text: string, customKeywords?: string[]): ModerationResult {
  const t = (text ?? '').toLowerCase()
  const allTerms = [...DEFAULT_SENSITIVE_TERMS, ...(customKeywords ?? [])]
  for (const term of allTerms) {
    if (term.trim() && t.includes(term.toLowerCase())) {
      return { flagged: true, reason: `命中敏感内容规则`, source: 'keywords' }
    }
  }
  return { flagged: false }
}

/** DashScope AI 内容安全审查（通义内容审核 API） */
async function checkWithAI(text: string): Promise<ModerationResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) return { flagged: false } // 未配 Key 跳过 AI 审查

  try {
    // 用 qwen-turbo 做轻量审查判断（成本低、速度快）
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          {
            role: 'system',
            content: `你是内容安全审查员。判断用户输入是否涉及以下违规类别：
1. 暴力/恐怖：涉及暴力行为、恐怖活动、武器制造
2. 违禁品：毒品、管制药品、违禁物交易
3. 自残/自杀：鼓励或教唆自残自杀
4. 色情/低俗：色情内容、性暗示
5. 歧视/仇恨：种族歧视、性别歧视、地域歧视
6. 违法犯罪：教唆犯罪、诈骗方法、洗钱
7. 政治敏感：涉及政治敏感内容

仅输出 JSON：{"flagged": true/false, "category": "类别名", "reason": "简要原因"}
如果内容安全无问题，输出 {"flagged": false}`,
          },
          { role: 'user', content: text.slice(0, 500) }, // 截断避免超长
        ],
        temperature: 0,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(5000), // 5s 超时
    })

    if (!res.ok) return { flagged: false } // API 调用失败不阻断

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? ''
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { flagged: false }

    const result = JSON.parse(jsonMatch[0]) as { flagged?: boolean; category?: string; reason?: string }
    if (result.flagged) {
      return {
        flagged: true,
        reason: result.reason || `AI 审查：${result.category ?? '违规内容'}`,
        source: 'ai',
      }
    }
    return { flagged: false }
  } catch {
    // AI 审查异常不阻断正常对话
    return { flagged: false }
  }
}

/**
 * 综合内容审查（输入或输出均可调用）。
 * @param text 待审查文本
 * @param config 审查配置（来自 Agent config）
 */
export async function moderateContent(
  text: string,
  config?: ModerationConfig,
): Promise<ModerationResult> {
  const level = config?.level ?? 'keywords'

  // 关键词审查（keywords / both）
  if (level === 'keywords' || level === 'both') {
    const kwResult = checkKeywords(text, config?.customKeywords)
    if (kwResult.flagged) return kwResult
  }

  // AI 语义审查（ai / both）
  if (level === 'ai' || level === 'both') {
    const aiResult = await checkWithAI(text)
    if (aiResult.flagged) return aiResult
  }

  return { flagged: false }
}

/** 向后兼容：同步版（仅关键词，不调 AI） */
export function moderateText(text: string): ModerationResult {
  return checkKeywords(text)
}
