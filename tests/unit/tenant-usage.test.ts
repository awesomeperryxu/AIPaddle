/**
 * L2 单元测试 · 4.8.x 租户管理去 mock · 每租户用量聚合
 * 验证 getTenantUsage 按 org_id 聚合 members/agents/tokens30d/estCost30d，
 * getPlatformRevenueTrend 输出近 6 月估算收入（末月落桶）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantUsage, getPlatformRevenueTrend } from '@/lib/data/platform-dashboard'

type Rows = Record<string, unknown[]>

// 伪 supabase 查询构造器：select/is/gte 链式返回自身，await 时 resolve 该表数据
function fakeAdmin(data: Rows) {
  const make = (rows: unknown[]) => {
    const res = { data: rows, error: null }
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.is = () => builder
    builder.gte = () => builder
    builder.eq = () => builder
    builder.then = (resolve: (v: unknown) => unknown) => resolve(res)
    return builder
  }
  return { from: (t: string) => make(data[t] ?? []) }
}

const mockCreate = vi.mocked(createAdminClient)

beforeEach(() => vi.clearAllMocks())

describe('getTenantUsage（每租户真实用量聚合）', () => {
  it('按 org_id 聚合成员/Agent/Token/估算成本', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        users: [{ org_id: 'a' }, { org_id: 'a' }, { org_id: 'b' }],
        agents: [{ org_id: 'a' }],
        call_logs: [
          { org_id: 'a', tokens_in: 1000, tokens_out: 1000, key_source: 'platform' },
          { org_id: 'b', tokens_in: 2000, tokens_out: 0, key_source: 'platform' },
        ],
      }) as never,
    )

    const usage = await getTenantUsage()
    expect(usage.a).toMatchObject({ members: 2, agents: 1, tokens30d: 2000, estCost30d: 0.0028, platformTokens30d: 2000 })
    expect(usage.b).toMatchObject({ members: 1, agents: 0, tokens30d: 2000, estCost30d: 0.0016, platformTokens30d: 2000 })
  })

  // 4.8.17a/b：Key 来源决定成本归属——BYO 与来源未知都不计入平台成本
  it('BYO（key_source=tenant）的 Token 计入用量但不计入平台成本', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [{ org_id: 'a', tokens_in: 1_000_000, tokens_out: 1_000_000, key_source: 'tenant' }],
        tenant_model_providers: [{ org_id: 'a', enabled: true }],
      }) as never,
    )
    const usage = await getTenantUsage()
    expect(usage.a.tokens30d).toBe(2_000_000)
    expect(usage.a.byoTokens30d).toBe(2_000_000)
    expect(usage.a.estCost30d).toBe(0)      // 关键：租户自己付的钱不算平台成本
    expect(usage.a.keyMode).toBe('byo')
  })

  it('key_source 为 NULL 的历史数据归「来源未知」，同样不计成本（不制造假精确）', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({ call_logs: [{ org_id: 'a', tokens_in: 1000, tokens_out: 1000, key_source: null }] }) as never,
    )
    const usage = await getTenantUsage()
    expect(usage.a.unknownTokens30d).toBe(2000)
    expect(usage.a.platformTokens30d).toBe(0)
    expect(usage.a.estCost30d).toBe(0)
  })

  it('配了 BYO 但仍有平台调用（非兼容供应商回退）→ keyMode=mixed', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [
          { org_id: 'a', tokens_in: 1000, tokens_out: 0, key_source: 'tenant' },
          { org_id: 'a', tokens_in: 500, tokens_out: 0, key_source: 'platform' },
        ],
        tenant_model_providers: [{ org_id: 'a', enabled: true }],
      }) as never,
    )
    expect((await getTenantUsage()).a.keyMode).toBe('mixed')
  })

  it('未配供应商且有调用 → keyMode=platform；停用的供应商不算 BYO', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [{ org_id: 'a', tokens_in: 1000, tokens_out: 0, key_source: 'platform' }],
        tenant_model_providers: [{ org_id: 'a', enabled: false }],
      }) as never,
    )
    expect((await getTenantUsage()).a.keyMode).toBe('platform')
  })

  it('无任何数据 → 空对象', async () => {
    mockCreate.mockReturnValue(fakeAdmin({}) as never)
    expect(await getTenantUsage()).toEqual({})
  })
})

describe('getPlatformRevenueTrend（近 6 月估算收入）', () => {
  it('输出 6 个月，末月落桶且为估算成本', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [{ tokens_in: 1_000_000, tokens_out: 1_000_000, created_at: new Date().toISOString() }],
      }) as never,
    )

    const trend = await getPlatformRevenueTrend()
    expect(trend).toHaveLength(6)
    expect(trend[5].cost).toBe(2.8) // (1000*0.0008)+(1000*0.002)=2.8
    expect(trend.slice(0, 5).every((p) => p.cost === 0)).toBe(true)
  })
})
