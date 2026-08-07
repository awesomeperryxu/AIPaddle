/**
 * L2 测试 · WF-28 保存乐观锁
 *
 * 🔴 编辑器把图读进内存后就只认内存那份，800ms 防抖自动保存会**整张覆盖**回去。
 * 于是「后台修过数据 / 另一人同时在改 / 同账号开了两个标签页」时，
 * 旧页面随便拖一下就把新数据静默抹掉——2026-08-07 后台修完用户的流程后差点就这样丢掉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { row: null as Record<string, unknown> | null, updated: null as Record<string, unknown> | null }

const makeQuery = (result: () => unknown) => {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'update']) {
    q[m] = vi.fn((...args: unknown[]) => {
      if (m === 'update') state.updated = args[0] as Record<string, unknown>
      return q
    })
  }
  q.maybeSingle = async () => ({ data: result(), error: null })
  return q
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => makeQuery(() => state.row) }),
}))

import { saveWorkflowChecked } from '@/lib/data/workflow'

const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const ROW = (updated: string) => ({
  id: 'w1', name: 'w', type: 'workflow', status: 'draft', version: 1,
  graph: { nodes: [], edges: [] }, updated_at: updated,
})

beforeEach(() => { state.row = null; state.updated = null; vi.clearAllMocks() })

describe('乐观锁', () => {
  it('基线与库里一致 → 正常保存', async () => {
    state.row = ROW('2026-08-07T10:00:00.000Z')
    const r = await saveWorkflowChecked(ctx, 'w1', { name: 'x' }, '2026-08-07T10:00:00.000Z')
    expect(r.ok).toBe(true)
  })

  it('🔴 库里已被改过 → 拒绝写入并回传当前版本', async () => {
    state.row = ROW('2026-08-07T11:00:00.000Z') // 别人在 11:00 改过
    const r = await saveWorkflowChecked(ctx, 'w1', { name: '旧页面的名字' }, '2026-08-07T10:00:00.000Z')
    expect(r.ok).toBe(false)
    if (!r.ok && r.reason === 'conflict') {
      expect(r.current.updatedAtIso).toBe('2026-08-07T11:00:00.000Z')
    } else {
      throw new Error('应判为 conflict')
    }
  })

  it('时间戳格式不同但同一时刻 → 不误判（+00 与 Z 直接比字符串会炸）', async () => {
    state.row = ROW('2026-08-07 10:00:00+00')
    const r = await saveWorkflowChecked(ctx, 'w1', { name: 'x' }, '2026-08-07T10:00:00.000Z')
    expect(r.ok).toBe(true)
  })

  it('不传基线 → 按老行为直接保存（不破坏老客户端）', async () => {
    state.row = ROW('2026-08-07T10:00:00.000Z')
    const r = await saveWorkflowChecked(ctx, 'w1', { name: 'x' })
    expect(r.ok).toBe(true)
  })

  it('工作流不存在 → not_found 而非 conflict', async () => {
    state.row = null
    const r = await saveWorkflowChecked(ctx, 'w1', { name: 'x' }, '2026-08-07T10:00:00.000Z')
    expect(r).toMatchObject({ ok: false, reason: 'not_found' })
  })
})
