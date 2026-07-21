import 'server-only'
import type { RequestContext, Role } from '@/lib/context'

// ADR-007 权限矩阵（RBAC · 按 action 鉴权 · 默认拒绝 · 多角色取并集）。
// 唯一事实来源：新增写操作必须在此登记 action → 允许角色，漏配即 403。
export type Action =
  | 'agent:create'
  | 'agent:create:enterprise'
  | 'agent:update'
  | 'agent:delete'
  | 'agent:submit'
  | 'agent:review'
  | 'agent:chat'
  | 'knowledge:create'
  | 'knowledge:read'
  | 'knowledge:delete'
  | 'member:manage'
  | 'audit:read'
  | 'tenant:read'

// 每个 action 允许的角色集合；未列入矩阵的 action 视为无人允许（默认拒绝）。
const MATRIX: Record<Action, Role[]> = {
  'agent:create': ['Admin', 'Developer'],
  'agent:create:enterprise': ['Admin'],
  'agent:update': ['Admin', 'Developer'], // Developer 仅 own，归属校验在应用层附加
  'agent:delete': ['Admin', 'Developer'],
  'agent:submit': ['Admin', 'Developer'],
  'agent:review': ['Admin', 'Auditor'],
  'agent:chat': ['Admin', 'Developer', 'User', 'Auditor'],
  'knowledge:create': ['Admin', 'Developer'],
  'knowledge:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'knowledge:delete': ['Admin', 'Developer'],
  'member:manage': ['Admin'],
  'audit:read': ['Admin', 'Auditor'],
  'tenant:read': ['Admin', 'Auditor'], // 本租户信息/配额/用量查看（ADR-007）；跨租户 tenant:manage 属阶段 6
}

/** 多角色取并集：任一角色被允许即允许。默认拒绝。 */
export function hasPermission(roles: Role[], action: Action): boolean {
  const allowed = MATRIX[action]
  if (!allowed) return false
  return roles.some((r) => allowed.includes(r))
}

/** 便捷断言：给定上下文是否可执行该 action。 */
export function can(ctx: RequestContext, action: Action): boolean {
  return hasPermission(ctx.roles, action)
}
