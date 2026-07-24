/**
 * 单元 · lib/data/workflow 版本历史 / 回滚（4.4.10）
 *   1. listWorkflowVersions：按 version 倒序查询 + 字段映射
 *   2. restoreWorkflowVersion：取到快照图 → 写回工作流并置草稿
 *   3. restoreWorkflowVersion：版本不存在 → null（不触碰 workflows）
 * mock @/lib/supabase/server 的 createClient（请求级客户端 + RLS）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state, orderSpy, updateSpy } = vi.hoisted(() => ({
  state: { results: {} as Record<string, unknown> },
  orderSpy: vi.fn(),
  updateSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  const make = (result: unknown) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.is = () => b
    b.update = (fields: unknown) => { updateSpy(fields); return b }
    b.order = (...args: unknown[]) => { orderSpy(...args); return Promise.resolve(result) }
    b.maybeSingle = () => Promise.resolve(result)
    return b
  }
  return {
    createClient: vi.fn(async () => ({ from: (t: string) => make(state.results[t]) })),
  }
})

import { listWorkflowVersions, restoreWorkflowVersion } from '@/lib/data/workflow'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

describe('版本历史 / 回滚数据层（4.4.10）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listWorkflowVersions：按 version 倒序查询并映射字段', async () => {
    state.results = {
      workflow_versions: {
        data: [
          { id: 'a', version: 3, note: '发布 v3', created_by: 'u2', created_at: '2026-07-19T10:20:30Z' },
          { id: 'b', version: 2, note: null, created_by: 'u1', created_at: '2026-07-18T09:00:00Z' },
        ],
        error: null,
      },
    }
    const list = await listWorkflowVersions(ctx, 'wf-1')
    // 倒序查询：order('version', { ascending: false })
    expect(orderSpy).toHaveBeenCalledWith('version', { ascending: false })
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({ id: 'a', version: 3, note: '发布 v3', createdBy: 'u2', createdAt: '2026-07-19 10:20:30' })
    expect(list[1].note).toBeNull()
  })

  it('restoreWorkflowVersion：取到快照图并写回工作流（置草稿）', async () => {
    const snap = { nodes: [{ id: 'n1', type: 'start' }], edges: [] }
    state.results = {
      workflow_versions: { data: { graph: snap }, error: null },
      workflows: {
        data: { id: 'wf-1', name: 'W', type: 'workflow', status: 'draft', version: 2, graph: snap, updated_at: '2026-07-19T00:00:00Z' },
        error: null,
      },
    }
    const wf = await restoreWorkflowVersion(ctx, 'wf-1', 2)
    // 写回时把快照图落到 workflows 且状态置 draft
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ graph: snap, status: 'draft' }))
    expect(wf).not.toBeNull()
    expect(wf!.status).toBe('draft')
    expect(wf!.graph.nodes).toHaveLength(1)
  })

  it('restoreWorkflowVersion：版本不存在 → null 且不写回', async () => {
    state.results = {
      workflow_versions: { data: null, error: null },
      workflows: { data: null, error: null },
    }
    const wf = await restoreWorkflowVersion(ctx, 'wf-1', 999)
    expect(wf).toBeNull()
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
