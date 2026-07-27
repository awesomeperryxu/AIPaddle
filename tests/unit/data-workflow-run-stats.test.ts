/**
 * 单元 · lib/data/workflow.getWorkflowRunStats（GX-5）
 *   1. 空数据 → 返回空对象
 *   2. 聚合正确：executions/successRate/lastRunAt 按 workflow_id 分组
 *   3. 成功判定只认 status='succeeded'（其它枚举计入总数不计成功）
 *   4. RLS：查询带 .is('deleted_at', null)，只查未软删的运行
 * mock @/lib/supabase/server 的 createClient（请求级客户端 + RLS）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state, isSpy } = vi.hoisted(() => ({
  state: { result: { data: [] as unknown, error: null as unknown } },
  isSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  const make = () => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    // 链在 .is('deleted_at', null) 处终结并被 await
    b.is = (...args: unknown[]) => { isSpy(...args); return Promise.resolve(state.result) }
    return b
  }
  return { createClient: vi.fn(async () => ({ from: () => make() })) }
})

import { getWorkflowRunStats } from '@/lib/data/workflow'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

describe('getWorkflowRunStats（GX-5 运行统计聚合）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('空数据 → 空对象', async () => {
    state.result = { data: [], error: null }
    const stats = await getWorkflowRunStats(ctx)
    expect(stats).toEqual({})
  })

  it('按 workflow_id 聚合 executions/successRate/lastRunAt', async () => {
    state.result = {
      data: [
        { workflow_id: 'wf-a', status: 'succeeded', created_at: '2026-07-20T10:00:00Z' },
        { workflow_id: 'wf-a', status: 'succeeded', created_at: '2026-07-21T12:00:00Z' },
        { workflow_id: 'wf-a', status: 'failed', created_at: '2026-07-19T08:00:00Z' },
        { workflow_id: 'wf-b', status: 'succeeded', created_at: '2026-07-18T09:00:00Z' },
      ],
      error: null,
    }
    const stats = await getWorkflowRunStats(ctx)
    // wf-a：3 次运行，2 成功 → 67%（四舍五入），最近取最大时间
    expect(stats['wf-a']).toEqual({ executions: 3, successRate: 67, lastRunAt: '2026-07-21T12:00:00Z' })
    // wf-b：1 次运行，1 成功 → 100%
    expect(stats['wf-b']).toEqual({ executions: 1, successRate: 100, lastRunAt: '2026-07-18T09:00:00Z' })
  })

  it('非 succeeded 枚举计入总数但不计成功（running/failed/exception）', async () => {
    state.result = {
      data: [
        { workflow_id: 'wf-c', status: 'running', created_at: '2026-07-20T10:00:00Z' },
        { workflow_id: 'wf-c', status: 'failed', created_at: '2026-07-20T11:00:00Z' },
        { workflow_id: 'wf-c', status: 'exception', created_at: '2026-07-20T12:00:00Z' },
      ],
      error: null,
    }
    const stats = await getWorkflowRunStats(ctx)
    expect(stats['wf-c']).toEqual({ executions: 3, successRate: 0, lastRunAt: '2026-07-20T12:00:00Z' })
  })

  it('只查未软删的运行（.is deleted_at null）', async () => {
    state.result = { data: [], error: null }
    await getWorkflowRunStats(ctx)
    expect(isSpy).toHaveBeenCalledWith('deleted_at', null)
  })

  it('查询出错 → 抛错', async () => {
    state.result = { data: null, error: { message: 'boom' } }
    await expect(getWorkflowRunStats(ctx)).rejects.toThrow('boom')
  })
})
