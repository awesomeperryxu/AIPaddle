/**
 * L2 单元测试 · lib/auth/permissions.ts（3.4 RBAC 权限矩阵，ADR-007）
 * 不需要 Supabase、不需要网络；纯函数可直接断言。
 * 核心诉求：角色 × action 组合结果与 ADR-007 矩阵一致，尤其是"默认拒绝"。
 */
import { describe, it, expect } from 'vitest'
import { hasPermission, can } from '@/lib/auth/permissions'
import type { RequestContext } from '@/lib/context'

describe('hasPermission（ADR-007 矩阵）', () => {
  // ── agent:create ──────────────────────────────
  it('Admin 可创建 Agent', () => {
    expect(hasPermission(['Admin'], 'agent:create')).toBe(true)
  })
  it('Developer 可创建 Agent', () => {
    expect(hasPermission(['Developer'], 'agent:create')).toBe(true)
  })
  it('User 不可创建 Agent', () => {
    expect(hasPermission(['User'], 'agent:create')).toBe(false)
  })
  it('Auditor 不可创建 Agent', () => {
    expect(hasPermission(['Auditor'], 'agent:create')).toBe(false)
  })

  // ── agent:create:enterprise ───────────────────
  it('仅 Admin 可创建企业级 Agent', () => {
    expect(hasPermission(['Admin'], 'agent:create:enterprise')).toBe(true)
    expect(hasPermission(['Developer'], 'agent:create:enterprise')).toBe(false)
    expect(hasPermission(['User'], 'agent:create:enterprise')).toBe(false)
    expect(hasPermission(['Auditor'], 'agent:create:enterprise')).toBe(false)
  })

  // ── agent:review ──────────────────────────────
  it('Admin 和 Auditor 可审核 Agent', () => {
    expect(hasPermission(['Admin'], 'agent:review')).toBe(true)
    expect(hasPermission(['Auditor'], 'agent:review')).toBe(true)
  })
  it('Developer 和 User 不可审核', () => {
    expect(hasPermission(['Developer'], 'agent:review')).toBe(false)
    expect(hasPermission(['User'], 'agent:review')).toBe(false)
  })

  // ── member:manage ─────────────────────────────
  it('仅 Admin 可管理成员', () => {
    expect(hasPermission(['Admin'], 'member:manage')).toBe(true)
    expect(hasPermission(['Developer'], 'member:manage')).toBe(false)
    expect(hasPermission(['User'], 'member:manage')).toBe(false)
    expect(hasPermission(['Auditor'], 'member:manage')).toBe(false)
  })

  // ── audit:read ────────────────────────────────
  it('Admin 和 Auditor 可查看审计', () => {
    expect(hasPermission(['Admin'], 'audit:read')).toBe(true)
    expect(hasPermission(['Auditor'], 'audit:read')).toBe(true)
  })
  it('Developer 和 User 不可查看审计', () => {
    expect(hasPermission(['Developer'], 'audit:read')).toBe(false)
    expect(hasPermission(['User'], 'audit:read')).toBe(false)
  })

  // ── agent:chat ────────────────────────────────
  it('全部角色均可对话', () => {
    expect(hasPermission(['Admin'], 'agent:chat')).toBe(true)
    expect(hasPermission(['Developer'], 'agent:chat')).toBe(true)
    expect(hasPermission(['User'], 'agent:chat')).toBe(true)
    expect(hasPermission(['Auditor'], 'agent:chat')).toBe(true)
  })

  // ── 多角色并集 ─────────────────────────────────
  it('多角色取并集：User+Admin 可创建 Agent', () => {
    expect(hasPermission(['User', 'Admin'], 'agent:create')).toBe(true)
  })
  it('多角色取并集：仅 User 时不可', () => {
    expect(hasPermission(['User'], 'agent:create')).toBe(false)
  })

  // ── 默认拒绝 ───────────────────────────────────
  it('未登记 action 默认拒绝（Admin 也不行）', () => {
    // @ts-expect-error — 故意传非法 action 验证默认拒绝
    expect(hasPermission(['Admin'], 'unknown:action')).toBe(false)
  })
  it('空角色数组默认拒绝', () => {
    expect(hasPermission([], 'agent:create')).toBe(false)
  })
})

describe('can（RequestContext 快捷方式）', () => {
  const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
  const devCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
  const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
  const auditorCtx: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }

  it('Admin 可做所有 action', () => {
    expect(can(adminCtx, 'agent:create')).toBe(true)
    expect(can(adminCtx, 'agent:review')).toBe(true)
    expect(can(adminCtx, 'member:manage')).toBe(true)
    expect(can(adminCtx, 'audit:read')).toBe(true)
  })

  it('Developer 不可审核和管理成员', () => {
    expect(can(devCtx, 'agent:create')).toBe(true)
    expect(can(devCtx, 'agent:review')).toBe(false)
    expect(can(devCtx, 'member:manage')).toBe(false)
  })

  it('User 只能对话', () => {
    expect(can(userCtx, 'agent:chat')).toBe(true)
    expect(can(userCtx, 'agent:create')).toBe(false)
    expect(can(userCtx, 'agent:review')).toBe(false)
  })

  it('Auditor 可审核可查日志不可创建', () => {
    expect(can(auditorCtx, 'agent:review')).toBe(true)
    expect(can(auditorCtx, 'audit:read')).toBe(true)
    expect(can(auditorCtx, 'agent:create')).toBe(false)
    expect(can(auditorCtx, 'agent:chat')).toBe(true)
  })
})
