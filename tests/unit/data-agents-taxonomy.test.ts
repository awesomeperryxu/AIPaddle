/**
 * 单元 · lib/data/agents 来源分类映射（4.1.17 / ADR-013）
 *   1. mapRow：origin/mandatory 透传 + category 四类派生（与 Skill 同构）
 *   2. platform + mandatory → platform-builtin；platform + 非强制 → platform-market
 *   3. user + draft → user-private；user + published → user-shared
 * mock @/lib/supabase/server 的 createClient（请求级客户端 + RLS）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state } = vi.hoisted(() => ({
  state: { results: {} as Record<string, unknown> },
}))

vi.mock('@/lib/supabase/server', () => {
  const make = (result: unknown) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.is = () => b
    b.order = () => Promise.resolve(result)
    b.maybeSingle = () => Promise.resolve(result)
    return b
  }
  return {
    createClient: vi.fn(async () => ({ from: (t: string) => make(state.results[t]) })),
  }
})

import { listAgents, getAgentById } from '@/lib/data/agents'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

function row(over: Record<string, unknown>) {
  return {
    id: '456d60b5-8d64-445a-b9d1-4d9c30e9ae92',
    name: 'A', description: null, department: null,
    status: 'published', metrics_calls: 0, metrics_success: 0,
    created_at: '2026-07-01T00:00:00Z', config: null,
    origin: 'user', mandatory: false,
    ...over,
  }
}

describe('lib/data/agents 来源分类映射（4.1.17 / ADR-013）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listAgents：透传 origin/mandatory 并派生四类 category', async () => {
    state.results = {
      agents: {
        data: [
          row({ origin: 'platform', mandatory: true, status: 'published' }),
          row({ origin: 'platform', mandatory: false, status: 'published' }),
          row({ origin: 'user', mandatory: false, status: 'draft' }),
          row({ origin: 'user', mandatory: false, status: 'published' }),
        ],
        error: null,
      },
    }
    const list = await listAgents(ctx)
    expect(list[0]).toMatchObject({ origin: 'platform', mandatory: true, category: 'platform-builtin' })
    expect(list[1]).toMatchObject({ origin: 'platform', mandatory: false, category: 'platform-market' })
    expect(list[2]).toMatchObject({ origin: 'user', mandatory: false, category: 'user-private' })
    expect(list[3]).toMatchObject({ origin: 'user', mandatory: false, category: 'user-shared' })
  })

  it('getAgentById：非法/缺失 origin 归一为 user，mandatory 归一为布尔', async () => {
    state.results = {
      agents: { data: row({ origin: 'weird', mandatory: null, status: 'draft' }), error: null },
    }
    const agent = await getAgentById(ctx, '456d60b5-8d64-445a-b9d1-4d9c30e9ae92')
    expect(agent).not.toBeNull()
    expect(agent!.origin).toBe('user')
    expect(agent!.mandatory).toBe(false)
    expect(agent!.category).toBe('user-private')
  })
})
