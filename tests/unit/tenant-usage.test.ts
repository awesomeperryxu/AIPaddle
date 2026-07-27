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
          { org_id: 'a', tokens_in: 1000, tokens_out: 1000 },
          { org_id: 'b', tokens_in: 2000, tokens_out: 0 },
        ],
      }) as never,
    )

    const usage = await getTenantUsage()
    expect(usage.a).toEqual({ members: 2, agents: 1, tokens30d: 2000, estCost30d: 0.0028 })
    expect(usage.b).toEqual({ members: 1, agents: 0, tokens30d: 2000, estCost30d: 0.0016 })
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
