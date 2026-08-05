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
  | 'mcp:create'
  | 'mcp:update'
  | 'mcp:delete'
  | 'mcp:submit'
  | 'mcp:review'
  | 'mcp:read'
  | 'skill:create'
  | 'skill:update'
  | 'skill:delete'
  | 'skill:submit'
  | 'skill:review'
  | 'knowledge:create'
  | 'knowledge:read'
  | 'knowledge:delete'
  | 'member:manage'
  | 'tenant:read'
  | 'tenant:manage'
  | 'audit:read'
  | 'workflow:create'
  | 'workflow:read'
  | 'workflow:update'
  | 'workflow:delete'
  | 'workflow:run'
  | 'provider:manage'
  | 'provider:manage-any'
  | 'apikey:manage'
  | 'apikey:manage-any'
  | 'department:read'
  | 'department:manage'
  // ── V12-8.3 Extension 对外 API（任务包 8a，ADR-020）────────────────────
  | 'ext:read'
  | 'ext:create'
  | 'ext:update'
  | 'ext:delete'
  | 'ext:publish'
  | 'ext:key:manage'
  | 'ext:call-log:read'
  // ── V12-2.x Plugin / Tool / Credential 底座（任务包 2，ADR-018）──────────
  | 'plugin:read'
  | 'plugin:create'
  | 'plugin:update'
  | 'plugin:delete'
  | 'plugin:submit'
  | 'plugin:review'
  | 'plugin:install'
  | 'plugin:manage-any'
  | 'tool:read'
  | 'tool:create'
  | 'tool:update'
  | 'tool:delete'
  | 'tool:submit'
  | 'tool:review'
  | 'credential:read'
  | 'credential:create'
  | 'credential:update'
  | 'credential:delete'

// 每个 action 允许的角色集合；未列入矩阵的 action 视为无人允许（默认拒绝）。
const MATRIX: Record<Action, Role[]> = {
  'agent:create': ['Admin', 'Developer'],
  'agent:create:enterprise': ['Admin'],
  'agent:update': ['Admin', 'Developer'], // Developer 仅 own，归属校验在应用层附加
  'agent:delete': ['Admin', 'Developer'],
  'agent:submit': ['Admin', 'Developer'],
  'agent:review': ['Admin', 'Auditor'],
  'agent:chat': ['Admin', 'Developer', 'User', 'Auditor'],
  // MCP 管理中心（4.3.0，ADR-004）：注册/编辑=Admin/Developer；审批·启停=Admin/Auditor（治理动作）
  'mcp:create': ['Admin', 'Developer'],
  'mcp:update': ['Admin', 'Developer'],
  'mcp:delete': ['Admin'],
  'mcp:submit': ['Admin', 'Developer'],
  'mcp:review': ['Admin', 'Auditor'],
  'mcp:read': ['Admin', 'Auditor'], // 管理端全量清单（含 draft/pending）；my_mcp_servers 视图另走
  // Skill Hub（4.3.1，ADR-007）：创建/编辑=Admin/Developer(Developer 仅 own)；审核=Admin/Auditor
  'skill:create': ['Admin', 'Developer'],
  'skill:update': ['Admin', 'Developer'],
  'skill:delete': ['Admin', 'Developer'],
  'skill:submit': ['Admin', 'Developer'],
  'skill:review': ['Admin', 'Auditor'],
  'knowledge:create': ['Admin', 'Developer'],
  'knowledge:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'knowledge:delete': ['Admin', 'Developer'],
  'member:manage': ['Admin'],
  'tenant:read': ['Admin', 'Auditor'],
  'tenant:manage': ['Admin'],
  'audit:read': ['Admin', 'Auditor'],
  'workflow:create': ['Admin', 'Developer'],
  'workflow:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'workflow:update': ['Admin', 'Developer'], // Developer 仅 own，归属校验在应用层
  'workflow:delete': ['Admin', 'Developer'], // Developer 仅 own，归属校验在应用层（软删，RLS 兜底租户隔离）
  'workflow:run': ['Admin', 'Developer', 'User'],
  // 模型供应商（ADR-016 4.7.3）：租户管理员自助配供应商/Key/默认模型。跨租户代配走 isPlatformAdmin。
  'provider:manage': ['Admin'],
  // 4.8.10：跨租户代配模型供应商。**矩阵里对所有角色留空**——它不是角色能力，
  // 而是平台超管专属：入口须再过 isPlatformAdmin(ctx)，与 tenant:manage 同一模式
  //（ADR-007 §5：平台超管走独立判定，不混进租户角色体系）。
  // 留在矩阵里是为了让「新增写操作必须登记 action」这条约定有据可查，默认拒绝。
  'provider:manage-any': [],
  // 对外 API Key（4.8.6）：签发/吊销本租户对外调用凭证，仅 Admin。
  'apikey:manage': ['Admin'],
  // Key-2：跨租户 Key 总览/吊销。同 provider:manage-any 模式——**矩阵留空**，
  // 单靠角色永远拒绝；入口须再过 isPlatformAdmin(ctx)。
  // 🔴 租户 Admin 绝不可跨租户看 Key：那是 ADR-002 隔离铁律的正面违反。
  'apikey:manage-any': [],
  // 组织架构（4.8.14a）：部门树全员可读（成员编辑/资源授权都要选部门）；增删改仅 Admin。
  // PRD 2.10.3 的「部门管理员」角色与「本部门及下级」数据权限尚未进 ADR-007，故本期不设部门级管理员。
  'department:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'department:manage': ['Admin'],

  // ── V12-8.3 Extension（ADR-020）────────────────────────────────────────
  // Extension 是**外部系统调用 AIPaddle** 的入口，等同于对外授权，因此写操作
  // 一律只给 Admin：Developer 能建 Agent 不代表能把它开放给公网。
  'ext:read': ['Admin', 'Developer', 'Auditor'],
  'ext:create': ['Admin'],
  'ext:update': ['Admin'],
  'ext:delete': ['Admin'],
  'ext:publish': ['Admin'],
  // 🔴 签发/撤销对外 Key = 对外授权，仅 Admin。Key 明文仅签发时一次性返回。
  'ext:key:manage': ['Admin'],
  // 调用日志含外部来源与调用量，Auditor 需要看得到
  'ext:call-log:read': ['Admin', 'Auditor'],

  // ── V12-2.x Plugin / Tool / Credential（ADR-018 / RBAC_ACTIONS_v1.13）──
  // 口径对齐 Agent：读放开全角色（RLS 兜租户隔离），写给 Admin + Developer，
  // 审核给 Admin + Auditor。
  'plugin:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'plugin:create': ['Admin', 'Developer'],
  'plugin:update': ['Admin', 'Developer'],   // Developer 仅 own，归属校验在应用层附加
  'plugin:delete': ['Admin', 'Developer'],
  'plugin:submit': ['Admin', 'Developer'],
  'plugin:review': ['Admin', 'Auditor'],
  'plugin:install': ['Admin', 'Developer'],
  // 🔴 平台超管专属，矩阵留空 ⇒ 单靠角色永远拒绝（同 provider:manage-any 模式）
  'plugin:manage-any': [],
  'tool:read': ['Admin', 'Developer', 'User', 'Auditor'],
  'tool:create': ['Admin', 'Developer'],
  'tool:update': ['Admin', 'Developer'],
  'tool:delete': ['Admin', 'Developer'],
  'tool:submit': ['Admin', 'Developer'],
  'tool:review': ['Admin', 'Auditor'],
  // 🔴 Credential 是最高敏感资产：User / Auditor 一律不给。
  // Auditor 只能从审计日志看到「谁在何时配置了哪个凭据」，看不到凭据本身。
  'credential:read': ['Admin', 'Developer'],   // 只返回脱敏值
  'credential:create': ['Admin', 'Developer'],
  'credential:update': ['Admin', 'Developer'],
  'credential:delete': ['Admin', 'Developer'],
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
