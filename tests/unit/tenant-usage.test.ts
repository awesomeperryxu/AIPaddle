/**
 * L2 单元测试 · 4.8.x 租户管理去 mock · 每租户用量聚合
 * 验证 getTenantUsage 按 org_id 聚合 members/agents/tokens30d/estCost30d，
 * 其中 members 自 ADR-025 起按 user_orgs 归属统计（跨组织的人在每个归属组织各计一次）。
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

// 4.8.17c：成本改由 model_pricing 决定。沿用迁移 0027 的种子价（与旧硬编码一致），
// 生效时间回溯，保证老用例的成本口径不变。
const PRICING = [
  { provider: 'platform-env', model: '*', input_per_1k: 0.0008, output_per_1k: 0.002, effective_from: '2020-01-01T00:00:00Z' },
  { provider: '*', model: '*', input_per_1k: 0.0008, output_per_1k: 0.002, effective_from: '2020-01-01T00:00:00Z' },
]

beforeEach(() => vi.clearAllMocks())

describe('getTenantUsage（每租户真实用量聚合）', () => {
  it('按 org_id 聚合成员/Agent/Token/估算成本', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        // ADR-025：成员改按**归属**统计（user_orgs 内联 users 过滤机器用户/软删）
        user_orgs: [
          { user_id: 'u1', org_id: 'a', users: { is_service_account: false, deleted_at: null } },
          { user_id: 'u2', org_id: 'a', users: { is_service_account: false, deleted_at: null } },
          { user_id: 'u3', org_id: 'b', users: { is_service_account: false, deleted_at: null } },
        ],
        agents: [{ org_id: 'a' }],
        call_logs: [
          { org_id: 'a', tokens_in: 1000, tokens_out: 1000, key_source: 'platform', provider: 'platform-env', model: 'qwen-plus', created_at: new Date().toISOString() },
          { org_id: 'b', tokens_in: 2000, tokens_out: 0, key_source: 'platform', provider: 'platform-env', model: 'qwen-plus', created_at: new Date().toISOString() },
        ],
        model_pricing: PRICING,
      }) as never,
    )

    const usage = await getTenantUsage()
    expect(usage.a).toMatchObject({ members: 2, agents: 1, tokens30d: 2000, calls30d: 1, estCost30d: 0.0028, platformTokens30d: 2000 })
    expect(usage.b).toMatchObject({ members: 1, agents: 0, tokens30d: 2000, calls30d: 1, estCost30d: 0.0016, platformTokens30d: 2000 })
  })

  // 4.9.x：调用次数=call_logs 行数，不分来源（平台/BYO/未知都计）
  it('calls30d 按 org 计 call_logs 行数，跨来源汇总', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [
          { org_id: 'a', tokens_in: 100, tokens_out: 0, key_source: 'platform', provider: 'platform-env', model: 'qwen-plus', created_at: new Date().toISOString() },
          { org_id: 'a', tokens_in: 100, tokens_out: 0, key_source: 'tenant' },
          { org_id: 'a', tokens_in: 100, tokens_out: 0, key_source: null },
          { org_id: 'b', tokens_in: 100, tokens_out: 0, key_source: 'platform', provider: 'platform-env', model: 'qwen-plus', created_at: new Date().toISOString() },
        ],
        model_pricing: PRICING,
      }) as never,
    )
    const usage = await getTenantUsage()
    expect(usage.a.calls30d).toBe(3)
    expect(usage.b.calls30d).toBe(1)
  })

  // 4.8.17a/b：Key 来源决定成本归属——BYO 与来源未知都不计入平台成本
  it('BYO（key_source=tenant）的 Token 计入用量但不计入平台成本', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [{ org_id: 'a', tokens_in: 1_000_000, tokens_out: 1_000_000, key_source: 'tenant' }],
        tenant_model_providers: [{ org_id: 'a', enabled: true }],
        model_pricing: PRICING,
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

  // 4.8.17c：定价缺失必须显性计数，不能悄悄算成 0 让成本看起来很美
  it('平台调用但 model_pricing 无匹配 → 计入 unpricedCalls30d，成本不虚报', async () => {
    mockCreate.mockReturnValue(
      fakeAdmin({
        call_logs: [{ org_id: 'a', tokens_in: 1000, tokens_out: 1000, key_source: 'platform', provider: 'unknown-vendor', model: 'unknown', created_at: new Date().toISOString() }],
        model_pricing: [],   // 定价表为空
      }) as never,
    )
    const usage = await getTenantUsage()
    expect(usage.a.platformTokens30d).toBe(2000)
    expect(usage.a.unpricedCalls30d).toBe(1)
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
        call_logs: [{ tokens_in: 1_000_000, tokens_out: 1_000_000, created_at: new Date().toISOString(), provider: 'platform-env', model: 'qwen-plus' }],
        model_pricing: PRICING,
      }) as never,
    )

    const trend = await getPlatformRevenueTrend()
    expect(trend).toHaveLength(6)
    expect(trend[5].cost).toBe(2.8) // (1000*0.0008)+(1000*0.002)=2.8
    expect(trend.slice(0, 5).every((p) => p.cost === 0)).toBe(true)
  })
})
