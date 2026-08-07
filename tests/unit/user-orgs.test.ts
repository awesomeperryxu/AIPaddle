/**
 * L2 测试 · ADR-025 多组织归属与切换
 *
 * 🔴 active_org_id 直接决定 RLS 放行哪一家的数据 —— 能自行乱切等于一键越权到任意租户。
 * 应用层这一道必须拦住非归属组织；数据库触发器是绕不过去的最后一道。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const db: Record<string, unknown[]> = {}
const updates: Record<string, unknown>[] = []

const makeQuery = (table: string) => {
  const filters: Record<string, unknown> = {}
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'is']) q[m] = vi.fn(() => q)
  q.eq = vi.fn((col: string, val: unknown) => { filters[col] = val; return q })
  q.update = vi.fn((patch: Record<string, unknown>) => { updates.push({ table, ...patch }); return q })
  const rows = () => (db[table] ?? []).filter((r) =>
    Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  q.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
  q.then = (res: (v: { data: unknown[]; error: null }) => unknown) => res({ data: rows(), error: null })
  return q
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (t: string) => makeQuery(t) }) }))

import { listMyOrgs, switchActiveOrg } from '@/lib/data/user-orgs'

const PLATFORM = 'aaaaaaaa-0000-4000-8000-000000000001'
const PINQI = 'bbbbbbbb-0000-4000-8000-000000000002'
const OTHER = 'cccccccc-0000-4000-8000-000000000003'
const ctx = { userId: 'u1', orgId: PLATFORM, roles: ['Admin' as const] }

beforeEach(() => {
  updates.length = 0
  db.user_orgs = [
    { user_id: 'u1', org_id: PLATFORM, tenants: { name: '平台管理团队', status: 'active' } },
    { user_id: 'u1', org_id: PINQI, tenants: { name: '北京品器管理咨询有限公司', status: 'active' } },
  ]
  db.users = [{ id: 'u1', org_id: PLATFORM }]
  db.user_roles = [
    { user_id: 'u1', org_id: PLATFORM, role: 'Admin' },
    { user_id: 'u1', org_id: PINQI, role: 'Admin' },
  ]
  vi.clearAllMocks()
})

describe('列出我的组织', () => {
  it('两个组织都列出，标出当前与主组织', async () => {
    const orgs = await listMyOrgs(ctx)
    expect(orgs).toHaveLength(2)
    const platform = orgs.find((o) => o.id === PLATFORM)!
    expect(platform).toMatchObject({ active: true, home: true, name: '平台管理团队' })
    expect(orgs.find((o) => o.id === PINQI)).toMatchObject({ active: false, home: false })
  })

  it('主组织排最前，便于稳定定位', async () => {
    expect((await listMyOrgs(ctx))[0].home).toBe(true)
  })

  it('带出在各组织里的角色——同一人在不同组织可以不同角色', async () => {
    db.user_roles = [{ user_id: 'u1', org_id: PINQI, role: 'Developer' }]
    const orgs = await listMyOrgs(ctx)
    expect(orgs.find((o) => o.id === PINQI)!.roles).toEqual(['Developer'])
    expect(orgs.find((o) => o.id === PLATFORM)!.roles).toEqual([])
  })
})

describe('切换活跃组织', () => {
  it('切到自己归属的组织 → 成功并写入 active_org_id', async () => {
    const r = await switchActiveOrg(ctx, PINQI)
    expect(r.ok).toBe(true)
    expect(updates.some((u) => u.table === 'users' && u.active_org_id === PINQI)).toBe(true)
  })

  it('🔴 切到未归属的组织 → 拒绝，且不写库（这条不拦就是越权）', async () => {
    const r = await switchActiveOrg(ctx, OTHER)
    expect(r).toMatchObject({ ok: false, reason: 'not_member' })
    expect(updates).toHaveLength(0)
  })

  it('🔴 目标组织已停用 → 拒绝切入（切进去会被 suspended 检查挡在门外）', async () => {
    db.user_orgs = [{ user_id: 'u1', org_id: PINQI, tenants: { name: '品器', status: 'suspended' } }]
    const r = await switchActiveOrg(ctx, PINQI)
    expect(r).toMatchObject({ ok: false, reason: 'suspended' })
    expect(updates).toHaveLength(0)
  })
})
