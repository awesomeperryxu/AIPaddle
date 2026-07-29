// 平台汇总指标明细页（/platform-metrics/[metric]）的合法指标定义。
// 纯常量模块（无 server-only）：供服务端页做动态段校验、客户端视图做标题/列映射，两处同一事实来源。

export const PLATFORM_METRICS = ['members', 'agents', 'tokens', 'calls', 'cost', 'tenants'] as const

export type PlatformMetric = (typeof PLATFORM_METRICS)[number]

export function isPlatformMetric(m: string): m is PlatformMetric {
  return (PLATFORM_METRICS as readonly string[]).includes(m)
}

// 各指标标题（明细页 H1 用「<title> · 明细」）
export const METRIC_TITLE: Record<PlatformMetric, string> = {
  members: '总成员',
  agents: 'Agent 数',
  tokens: '近 30 天 Token',
  calls: '近 30 天调用次数',
  cost: '近 30 天估算成本',
  tenants: '租户',
}
