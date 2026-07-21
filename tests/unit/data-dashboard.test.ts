/**
 * 单元 · lib/data/dashboard getDashboardStats（BUG-74 真实指标聚合）
 * mock supabase 各表返回，验证 Agent/审核/调用日志/Skill 的聚合正确。
 */
import { describe, it, expect, vi } from 'vitest'
import type { RequestContext } from '@/lib/context'

const today = new Date().toISOString()

const RESULTS: Record<string, unknown> = {
  agents: { data: [{ status: 'published' }, { status: 'draft' }, { status: 'published' }] },
  security_reviews: { count: 4 },
  call_logs: {
    data: [
      { tokens_in: 30, tokens_out: 12, success: true, created_at: today },
      { tokens_in: 20, tokens_out: 8, success: true, created_at: today },
      { tokens_in: 10, tokens_out: 5, success: false, created_at: '2020-01-01T00:00:00Z' },
    ],
  },
  skills: { data: [{ status: 'published' }, { status: 'draft' }] },
}

function makeBuilder(result: unknown) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.is = chain
  b.eq = chain
  // thenable：await 该 builder 即解析为 result
  b.then = (resolve: (v: unknown) => void) => resolve(result)
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => makeBuilder(RESULTS[table]),
  }),
}))

import { getDashboardStats } from '@/lib/data/dashboard'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

describe('getDashboardStats', () => {
  it('聚合 Agent / 审核 / 调用日志 / Skill 的真实指标', async () => {
    const s = await getDashboardStats(ctx)
    expect(s.totalAgents).toBe(3)
    expect(s.publishedAgents).toBe(2)
    expect(s.pendingReviews).toBe(4)
    expect(s.todayCalls).toBe(2) // 仅今日 2 条
    expect(s.todayTokens).toBe(70) // 30+12+20+8
    expect(s.successRate).toBe(66.7) // 2 成功 / 3 总
    expect(s.totalSkills).toBe(2)
    expect(s.publishedSkills).toBe(1)
  })
})
