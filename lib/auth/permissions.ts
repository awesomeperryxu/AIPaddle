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
  | 'workflow:create'
  | 'workflow:create:enterprise'
  | 'workflow:update'
  | 'workflow:delete'
  | 'workflow:read'
  | 'workflow:run'
  | 'workflow:submit'
  | 'workflow:review'
  | 'knowledge:create'
  | 'knowledge:read'
  | 'knowledge:delete'
  | 'member:manage'
  | 'tenant:read'
  | 'tenant:manage'
  | 'audit:read'

// 每个 action 允许的角色集合；未列入矩阵的 action 视为无人允许（默认拒绝）。
const MATRIX: Record<Action, Role[]> = {
  'agent:create': ['Admin', 'Developer'],
  'agent:create:enterprise': ['Admin'],
  'agent:update': ['Admin', 'Developer'], // Developer 仅 own，归属校验在应用层附加
  'agent:delete': ['Admin', 'Developer'],
  'agent:submit': ['Admin', 'Developer'],
  'agent:review': ['Admin', 'Auditor'],
  'agent:chat': ['Admin', 'Developer', 'User', 'Auditor'],
  // Workflow（ADR-007 矩阵）：Developer 的 update/delete 仅 own，归属校验在应用层附加
  'workflow:create': ['Admin', 'Developer'],
  'workflow:create:enterprise': ['Admin'],
  'workflow:update': ['Admin', 'Developer'],
  'workflow:delete': ['Admin', 'Developer'],
  'workflow:read': ['Admin', 'Developer', 'User', 'Auditor'], // User 仅已发布，应用层附加
  'workflow:run': ['Admin', 'Developer', 'User'], // User 仅已发布；Auditor 不可运行
  'workflow:submit': ['Admin', 'Developer'],
  'workflow:review': ['Admin', 'Auditor'],
  'knowledge:create': ['Admin', 'Developer'],
  'knowledge:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'knowledge:delete': ['Admin', 'Developer'],
  'member:manage': ['Admin'],
  'tenant:read': ['Admin', 'Auditor'],
  'tenant:manage': ['Admin'],
  'audit:read': ['Admin', 'Auditor'],
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
