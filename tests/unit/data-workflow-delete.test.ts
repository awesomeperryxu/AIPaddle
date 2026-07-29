/**
 * 单元 · lib/data/workflow.deleteWorkflow（GX-5 补遗）
 *   1. 软删：update 只写 deleted_at（时间戳），不物理删除
 *   2. RLS/幂等：where .eq('id') + .is('deleted_at', null)，只删未软删的行
 *   3. 出错 → 抛错
 * mock @/lib/supabase/server 的 createClient（请求级客户端 + RLS）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state, updateSpy, eqSpy, isSpy } = vi.hoisted(() => ({
  state: { result: { error: null as unknown } },
  updateSpy: vi.fn(),
  eqSpy: vi.fn(),
  isSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  const make = () => {
    const b: Record<string, unknown> = {}
    b.update = (...args: unknown[]) => { updateSpy(...args); return b }
    b.eq = (...args: unknown[]) => { eqSpy(...args); return b }
    // 链在 .is('deleted_at', null) 处终结并被 await
    b.is = (...args: unknown[]) => { isSpy(...args); return Promise.resolve(state.result) }
    return b
  }
  return { createClient: vi.fn(async () => ({ from: () => make() })) }
})

import { deleteWorkflow } from '@/lib/data/workflow'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Developer'] }

describe('deleteWorkflow（GX-5 工作流软删）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('软删只写 deleted_at 时间戳（非物理删除）', async () => {
    state.result = { error: null }
    await deleteWorkflow(ctx, 'wf-1')
    expect(updateSpy).toHaveBeenCalledOnce()
    const payload = updateSpy.mock.calls[0][0] as { deleted_at?: unknown }
    expect(payload).toHaveProperty('deleted_at')
    expect(typeof payload.deleted_at).toBe('string')
    // 只有 deleted_at 一个字段
    expect(Object.keys(payload)).toEqual(['deleted_at'])
  })

  it('按 id 定位且只删未软删的行（.eq id / .is deleted_at null）', async () => {
    state.result = { error: null }
    await deleteWorkflow(ctx, 'wf-1')
    expect(eqSpy).toHaveBeenCalledWith('id', 'wf-1')
    expect(isSpy).toHaveBeenCalledWith('deleted_at', null)
  })

  it('查询出错 → 抛错', async () => {
    state.result = { error: { message: 'boom' } }
    await expect(deleteWorkflow(ctx, 'wf-1')).rejects.toThrow('boom')
  })
})
