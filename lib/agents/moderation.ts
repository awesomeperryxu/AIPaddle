// 4.1.12：基础内容审查（敏感词规则版）。诚实定位：这是最小可用的关键词审查，
// 覆盖明显违规类目；生产可后续替换/叠加真实内容安全 API（如通义内容审核）。不夸大为“完整合规审查”。

// 最小敏感词集合（示例类目：暴力/危险行为/违禁品）。可按企业策略扩展或改为配置化。
const SENSITIVE_TERMS = [
  '制造炸弹', '制作炸弹', '炸弹制作', '爆炸物制作',
  '制毒', '制作毒品', '毒品交易',
  '枪支制造', '买卖枪支',
  '自杀方法', '如何自杀',
]

export type ModerationResult = { flagged: boolean; reason?: string }

/** 对文本做基础审查；命中敏感词则 flagged。 */
export function moderateText(text: string): ModerationResult {
  const t = (text ?? '').toLowerCase()
  for (const term of SENSITIVE_TERMS) {
    if (t.includes(term.toLowerCase())) {
      return { flagged: true, reason: `命中敏感内容规则（${term}）` }
    }
  }
  return { flagged: false }
}
