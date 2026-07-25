// ADR-013：Agent 四类来源分类（与 Skill #46 同构）。纯函数，前后端共用，不引 server-only/db。

export type AgentOrigin = 'platform' | 'user'
export type AgentStatus = 'draft' | 'pending' | 'published' | 'offline'
export type AgentCategory = 'platform-builtin' | 'platform-market' | 'user-private' | 'user-shared'

/** 四类派生 = origin + mandatory + status（与 Skill deriveCategory 同构）。 */
export function deriveAgentCategory(origin: AgentOrigin, mandatory: boolean, status: AgentStatus): AgentCategory {
  if (origin === 'platform') return mandatory ? 'platform-builtin' : 'platform-market'
  return status === 'draft' ? 'user-private' : 'user-shared'
}

export const AGENT_CATEGORY_LABEL: Record<AgentCategory, string> = {
  'platform-builtin': '平台内置·强制',
  'platform-market': '平台市场',
  'user-private': '用户自用',
  'user-shared': '用户推送',
}

/** 设"强制"或"平台来源"属高权写操作：需企业级创建权（agent:create:enterprise / 平台超管），防越权设强制下发。 */
export function requiresEnterprisePermission(input: { origin?: AgentOrigin; mandatory?: boolean }): boolean {
  return input.origin === 'platform' || input.mandatory === true
}
