import { describe, it, expect, vi, beforeEach } from 'vitest'

// DE-11 数据层：删 Agent 时必须同步软删**指向它的**下级引用。
//
// 🔴 这是 OPS-6 清掉的 65 行悬空引用的根因。此前 deleteAgent 只软删 agents 行，
// agent_resources 里 resource_id 指向它的那些行原封不动 —— 上级数字员工于是
// 挂着一条指向"不存在的 Agent"的活跃引用。表现极隐蔽：页面上只是"组成里少了一个"，
// 不主动比对根本发现不了。#161 删腾讯 Agent 时一次留下 65 行，波及 16 个数字员工。
//
// 本测试盯的是**接线**：删成功才清引用、清的是 resource_id（不是 agent_id）、
// 只清 resource_type='agent' 的行。这三点错任何一个，要么白清要么误删别的资源绑定。

const { agentsUpdate, resUpdate, maybeSingle } = vi.hoisted(() => ({
  agentsUpdate: vi.fn(),
  resUpdate: vi.fn(),
  maybeSingle: vi.fn(),
}))

// agent_resources 侧的链：update().eq().eq().is()
const resIs = vi.fn().mockResolvedValue({ error: null })
const resEq2 = vi.fn().mockReturnValue({ is: resIs })
const resEq1 = vi.fn().mockReturnValue({ eq: resEq2 })

// agents 侧删除链：update().eq().is().neq().select().maybeSingle()
const agentsChain = {
  eq: vi.fn().mockReturnValue({
    is: vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    }),
  }),
}
// 回查状态链：select().eq().is().maybeSingle()
const agentsSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    is: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
  }),
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'agent_resources') {
        resUpdate.mockReturnValue({ eq: resEq1 })
        return { update: resUpdate }
      }
      agentsUpdate.mockReturnValue(agentsChain)
      return { update: agentsUpdate, select: agentsSelect }
    }),
  }),
}))

import { deleteAgent } from '@/lib/data/agents'

const ctx = { userId: 'u1', orgId: 'org-1', roles: ['Admin'] }
const ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  resIs.mockResolvedValue({ error: null })
})

describe('deleteAgent 同步清理下级引用（DE-11）', () => {
  it('删除成功 → 软删指向它的 agent_resources 行', async () => {
    maybeSingle.mockResolvedValue({ data: { id: ID }, error: null })
    const r = await deleteAgent(ctx as never, ID)
    expect(r).toBe('deleted')
    // 确实动了 agent_resources
    expect(resUpdate).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }))
    // 🔴 过滤条件必须是 resource_type='agent' + resource_id=被删的那个
    expect(resEq1).toHaveBeenCalledWith('resource_type', 'agent')
    expect(resEq2).toHaveBeenCalledWith('resource_id', ID)
    // 只清未删的行，别把历史软删记录重复标记
    expect(resIs).toHaveBeenCalledWith('deleted_at', null)
  })

  it('🔴 清的是 resource_id 不是 agent_id——搞反会把"它引用别人"的绑定删掉', async () => {
    maybeSingle.mockResolvedValue({ data: { id: ID }, error: null })
    await deleteAgent(ctx as never, ID)
    const keys = resEq2.mock.calls.map((c) => c[0])
    expect(keys).toContain('resource_id')
    expect(keys).not.toContain('agent_id')
  })

  it('删除未发生（published，须先下线）→ 不动任何引用', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await deleteAgent(ctx as never, ID)
    expect(resUpdate).not.toHaveBeenCalled()
  })

  it('引用清理失败不回滚删除，只记日志（Agent 已删，回滚更难解释）', async () => {
    maybeSingle.mockResolvedValue({ data: { id: ID }, error: null })
    resIs.mockResolvedValue({ error: { message: 'boom' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await deleteAgent(ctx as never, ID)
    expect(r).toBe('deleted')       // 仍算删除成功
    expect(spy).toHaveBeenCalled()  // 但留了痕
    spy.mockRestore()
  })
})
