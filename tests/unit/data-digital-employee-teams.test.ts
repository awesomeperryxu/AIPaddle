/**
 * 单元 · lib/data/digital-employee-teams（4.1.19 / ADR-014）
 *   1. createTeam：插入草稿团队（org_id/created_by/status=draft），memberIds 初始为空
 *   2. updateTeam：覆盖式设成员——先删旧 team_members，再插新（仅合法 UUID、带 ord）
 * mock @/lib/supabase/server 的 createClient（请求级客户端 + RLS）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state, insertSpy, deleteSpy, updateSpy } = vi.hoisted(() => ({
  state: { results: {} as Record<string, unknown> },
  insertSpy: vi.fn(),
  deleteSpy: vi.fn(),
  updateSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  const make = (result: unknown) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.is = () => b
    b.in = () => b
    b.order = () => b
    b.update = (f: unknown) => { updateSpy(f); return b }
    b.delete = () => { deleteSpy(); return b }
    b.insert = (rows: unknown) => { insertSpy(rows); return b }
    b.single = () => Promise.resolve(result)
    b.maybeSingle = () => Promise.resolve(result)
    // thenable：`await builder` / `await builder.delete().eq()` 解析为配置结果
    b.then = (res: (v: unknown) => unknown) => res(result)
    return b
  }
  return {
    createClient: vi.fn(async () => ({ from: (t: string) => make(state.results[t]) })),
  }
})

import { createTeam, updateTeam } from '@/lib/data/digital-employee-teams'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const TEAM_ID = '11111111-1111-4111-8111-111111111111'
const A = '22222222-2222-4222-8222-222222222222'
const B = '33333333-3333-4333-8333-333333333333'

describe('数字员工团队数据层（4.1.19）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createTeam：插入草稿团队，memberIds 初始为空', async () => {
    state.results = {
      digital_employee_teams: {
        data: { id: TEAM_ID, name: '售后团队', description: null, status: 'draft', updated_at: '2026-07-25T00:00:00Z' },
        error: null,
      },
    }
    const team = await createTeam(ctx, { name: '售后团队' })
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org1', created_by: 'u1', name: '售后团队', status: 'draft' }),
    )
    expect(team.memberIds).toEqual([])
    expect(team.status).toBe('draft')
  })

  it('updateTeam：覆盖式设成员——先删旧再插新（带 org_id/ord）', async () => {
    state.results = {
      digital_employee_teams: {
        data: { id: TEAM_ID, name: '售后团队', description: '', status: 'draft', updated_at: '2026-07-25T00:00:00Z' },
        error: null,
      },
      team_members: { data: [{ agent_id: A, ord: 0 }, { agent_id: B, ord: 1 }], error: null },
    }
    const team = await updateTeam(ctx, TEAM_ID, { name: '售后团队', memberIds: [A, B] })
    // 覆盖式：先删旧成员
    expect(deleteSpy).toHaveBeenCalled()
    // 再插新成员：带 org_id + team_id + agent_id + ord
    expect(insertSpy).toHaveBeenCalledWith([
      { org_id: 'org1', team_id: TEAM_ID, agent_id: A, ord: 0 },
      { org_id: 'org1', team_id: TEAM_ID, agent_id: B, ord: 1 },
    ])
    expect(team!.memberIds).toEqual([A, B])
  })

  it('updateTeam：非法 UUID 成员被过滤，不进 insert', async () => {
    state.results = {
      digital_employee_teams: {
        data: { id: TEAM_ID, name: 'T', description: '', status: 'draft', updated_at: '2026-07-25T00:00:00Z' },
        error: null,
      },
      team_members: { data: [{ agent_id: A, ord: 0 }], error: null },
    }
    await updateTeam(ctx, TEAM_ID, { memberIds: [A, 'not-a-uuid', '1'] })
    expect(insertSpy).toHaveBeenCalledWith([{ org_id: 'org1', team_id: TEAM_ID, agent_id: A, ord: 0 }])
  })
})
