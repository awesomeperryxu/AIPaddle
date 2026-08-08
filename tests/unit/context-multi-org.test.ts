/**
 * L2 测试 · ADR-025 切换组织后的身份解析
 *
 * 🔴 核心断言：**角色必须跟着活跃组织走**。同一个人在 A 组织是 Admin、在 B 组织是 Developer，
 * 切到 B 就只能拿到 Developer——不按 org 过滤的话，他会带着 A 的 Admin 去 B 组织操作，
 * 这是一条静默的越权路径（不报错、界面也正常）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PLATFORM = 'aaaaaaaa-0000-4000-8000-000000000001'
const PINQI = 'bbbbbbbb-0000-4000-8000-000000000002'

const state = {
  activeOrg: PLATFORM as string | null,
  homeOrg: PLATFORM,
  tenantStatus: {} as Record<string, string>,
  roles: [] as { org_id: string; role: string }[],
}

const makeQuery = (table: string) => {
  const f: Record<string, unknown> = {}
  const q: Record<string, unknown> = {}
  q.select = vi.fn(() => q)
  q.eq = vi.fn((c: string, v: unknown) => { f[c] = v; return q })
  q.maybeSingle = async () => {
    if (table === 'users') return { data: { org_id: state.homeOrg, active_org_id: state.activeOrg }, error: null }
    if (table === 'tenants') return { data: { status: state.tenantStatus[f.id as string] ?? 'active' }, error: null }
    return { data: null, error: null }
  }
  q.then = (res: (v: { data: unknown[]; error: null }) => unknown) =>
    res({ data: table === 'user_roles' ? state.roles.filter((r) => r.org_id === f.org_id) : [], error: null })
  return q
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', app_metadata: { org_id: PLATFORM } } } }) },
    from: (t: string) => makeQuery(t),
  }),
}))

import { getRequestContext } from '@/lib/context'

beforeEach(() => {
  state.activeOrg = PLATFORM
  state.homeOrg = PLATFORM
  state.tenantStatus = {}
  state.roles = [
    { org_id: PLATFORM, role: 'Admin' },
    { org_id: PINQI, role: 'Developer' }, // 同一个人，在品器只是开发者
  ]
  vi.clearAllMocks()
})

describe('切换组织后的身份', () => {
  it('停在主组织 → 拿到主组织的 Admin', async () => {
    const ctx = await getRequestContext()
    expect(ctx).toMatchObject({ orgId: PLATFORM, roles: ['Admin'] })
  })

  it('🔴 切到品器 → 只拿到品器的 Developer，不会把主组织的 Admin 带过去', async () => {
    state.activeOrg = PINQI
    const ctx = await getRequestContext()
    expect(ctx!.orgId).toBe(PINQI)
    expect(ctx!.roles).toEqual(['Developer'])
    expect(ctx!.roles).not.toContain('Admin')
  })

  it('🔴 JWT claim 里的旧组织不再生效——claim 是登录那刻写死的，切换后不会变', async () => {
    state.activeOrg = PINQI // claim 仍是 PLATFORM
    const ctx = await getRequestContext()
    expect(ctx!.orgId).toBe(PINQI)
  })

  it('在某组织没有角色 → roles 为空，而不是沿用别处的角色', async () => {
    state.activeOrg = PINQI
    state.roles = [{ org_id: PLATFORM, role: 'Admin' }]
    const ctx = await getRequestContext()
    expect(ctx!.roles).toEqual([])
  })

  it('🔴 活跃组织被停用 → 回落主组织并取主组织角色，而不是把人锁在门外', async () => {
    state.activeOrg = PINQI
    state.tenantStatus[PINQI] = 'suspended'
    const ctx = await getRequestContext()
    expect(ctx).toMatchObject({ orgId: PLATFORM, roles: ['Admin'] })
  })

  it('主组织也被停用 → 才真正拒绝访问', async () => {
    state.activeOrg = PINQI
    state.tenantStatus[PINQI] = 'suspended'
    state.tenantStatus[PLATFORM] = 'suspended'
    expect(await getRequestContext()).toBeNull()
  })
})
