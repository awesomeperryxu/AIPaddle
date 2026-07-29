/**
 * Agent 名称校验（S1-CRUD-02）。
 *
 * 背景：创建与改名此前**都不校验名称**——空名、超长名都能直接落库，编排页顶栏
 * 改名清空后自动保存照样成功，列表里就出现一张无名卡片。e2e 早有断言，但被
 * 「列表是卡片不是 table」的定位问题掩盖，一直混在「测试挂了」里没被当成缺陷。
 *
 * 放在 lib/agents/（纯逻辑）而非 lib/data/agents.ts 的原因：
 * 数据层带 `import 'server-only'` 且在单测里被整体 vi.mock——校验一旦放进去，
 * 任何 mock 数据层的路由测试都会拿到 undefined 的 AgentValidationError，
 * `instanceof` 直接抛错。纯校验函数没有服务端依赖，独立成模块两边都能安全引用。
 */

export const AGENT_NAME_MAX = 100

/** 入参校验失败——路由据此返回 4xx 而非 500。 */
export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentValidationError'
  }
}

/** 校验并返回规范化（trim 后）的名称；不合法则抛 AgentValidationError。 */
export function assertAgentName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new AgentValidationError('名称不能为空')
  if (trimmed.length > AGENT_NAME_MAX) {
    throw new AgentValidationError(`名称过长（最多 ${AGENT_NAME_MAX} 字）`)
  }
  return trimmed
}
