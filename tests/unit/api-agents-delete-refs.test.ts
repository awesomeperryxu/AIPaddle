/**
 * 单元 · DE-11 删除 Agent 时的依赖提醒与引用清理
 *
 * 🔴 这是 OPS-6 清掉的那 65 行悬空引用的**根因**：
 * `deleteAgent` 只软删 agents 行，不清理指向它的 agent_resources 引用，
 * 也不检查有没有上级在用。#161 删腾讯 Agent 时就这么留下了 65 行，
 * 波及 19 个数字员工里的 16 个——而页面上只表现为"组成里少了一个"。
 *
 * DE-8 拦的是「下线」，删除路径此前完全没拦。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({
  getAgentById: vi.fn(), saveAgent: vi.fn(), deleteAgent: vi.fn(),
}))
vi.mock('@/lib/data/de-dependents', () => ({ listDependentDigitalEmployees: vi.fn() }))
vi.mock('@/lib/agents/brain', () => ({ detectBrainCycle: vi.fn(async () => false) }))

import { getRequestContext } from '@/lib/context'
import { deleteAgent } from '@/lib/data/agents'
import { listDependentDigitalEmployees } from '@/lib/data/de-dependents'
import { DELETE } from '@/app/api/agents/[id]/route'

const mockCtx = vi.mocked(getRequestContext)
const mockDelete = vi.mocked(deleteAgent)
const mockDeps = vi.mocked(listDependentDigitalEmployees)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const ID = '11111111-1111-4111-8111-111111111111'

const del = (body?: unknown) =>
  DELETE(
    new Request('http://x', { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
    { params: Promise.resolve({ id: ID }) },
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(admin)
  mockDelete.mockResolvedValue('deleted')
  mockDeps.mockResolvedValue([])
})

describe('无人引用 → 正常删除', () => {
  it('直接删掉，不需要 confirm', async () => {
    const res = await del()
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(admin, ID)
  })
})

describe('被数字员工引用 → 先提醒', () => {
  it('回 409 + 受影响清单，且**没有真的删**', async () => {
    mockDeps.mockResolvedValue([{ id: 'de1', name: '内容创作专家团', status: 'published' }])
    const res = await del()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('has_dependents')
    expect(body.affectedDigitalEmployees[0].name).toBe('内容创作专家团')
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('confirm=true 后才真删', async () => {
    mockDeps.mockResolvedValue([{ id: 'de1', name: '内容创作专家团', status: 'published' }])
    const res = await del({ confirm: true })
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(admin, ID)
  })

  it('🔴 草稿态的上级也要提醒——DE-8 的级联只管 published，删除会漏掉它们', async () => {
    mockDeps.mockResolvedValue([{ id: 'de2', name: '草稿团', status: 'draft' }])
    const res = await del()
    expect(res.status).toBe(409)
    expect((await res.json()).affectedDigitalEmployees[0].status).toBe('draft')
  })

  it('多个上级时数量如实报出', async () => {
    mockDeps.mockResolvedValue([
      { id: 'de1', name: 'A', status: 'published' },
      { id: 'de2', name: 'B', status: 'draft' },
      { id: 'de3', name: 'C', status: 'offline' },
    ])
    const res = await del()
    const body = await res.json()
    expect(body.error.message).toContain('3 个')
    expect(body.affectedDigitalEmployees).toHaveLength(3)
  })
})

describe('原有行为不受影响', () => {
  it('已发布的仍拒绝删除（须先下线）', async () => {
    mockDelete.mockResolvedValue('published')
    const res = await del()
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toMatch(/先下线/)
  })

  it('不存在 / 跨租户 → 404', async () => {
    mockDelete.mockResolvedValue('not_found')
    expect((await del()).status).toBe(404)
  })

  it('无 agent:delete 权限 → 403，且不查依赖（省一次查询）', async () => {
    mockCtx.mockResolvedValue({ userId: 'u2', orgId: 'o1', roles: ['User'] })
    const res = await del()
    expect(res.status).toBe(403)
    expect(mockDeps).not.toHaveBeenCalled()
  })
})
