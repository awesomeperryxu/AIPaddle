/**
 * L3 集成测试 · app/api/agents/[id]（DELETE 软删除，4.1.1）
 * 测四件事（docs/TESTING.md L3 约定）：
 *   1. 正常（Admin，存在）→ 200 { ok: true }
 *   2. 目标不存在 / 跨租户（deleteAgent 返回 false）→ 404
 *   3. 无权限角色（User，无 agent:delete）→ 403
 *   4. 未登录 → 401
 * 真实跨租户隔离（RLS 兜底）由 3.7 S0-ISO 专项脚本覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({
  getAgentById: vi.fn(),
  saveAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { deleteAgent, saveAgent } from '@/lib/data/agents'
import { DELETE, PATCH } from '@/app/api/agents/[id]/route'

const mockCtx = vi.mocked(getRequestContext)
const mockDelete = vi.mocked(deleteAgent)
const mockSave = vi.mocked(saveAgent)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'

function call(id = ID) {
  return DELETE(new Request(`http://localhost/api/agents/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  })
}

function callPatch(body: unknown, id = ID) {
  return PATCH(
    new Request(`http://localhost/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  )
}

describe('DELETE /api/agents/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await call()
    expect(res.status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('无权限角色（User）→ 403，且不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    const res = await call()
    expect(res.status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Admin 删除存在的 Agent → 200 { ok: true }', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockDelete.mockResolvedValueOnce(true)
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledWith(adminCtx, ID)
  })

  it('目标不存在 / 跨租户（deleteAgent=false）→ 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockDelete.mockResolvedValueOnce(false)
    const res = await call()
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/agents/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await callPatch({ name: '改名' })
    expect(res.status).toBe(401)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('无权限角色（User）→ 403，且不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    const res = await callPatch({ name: '改名' })
    expect(res.status).toBe(403)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('Admin 更新存在的 Agent（名称/部门）→ 200 { agent }', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSave.mockResolvedValueOnce({ id: ID, name: '新名', department: '研发', description: '', status: 'draft', config: {} } as never)
    const res = await callPatch({ name: '新名', department: '研发' })
    expect(res.status).toBe(200)
    expect((await res.json()).agent.name).toBe('新名')
    expect(mockSave).toHaveBeenCalledWith(adminCtx, ID, {
      name: '新名',
      department: '研发',
      description: undefined,
      config: undefined,
    })
  })

  it('Admin 更新 config（4.1.7）→ 200 且 config 透传给数据层', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSave.mockResolvedValueOnce({ id: ID, name: 'A', department: '', description: '', status: 'draft', config: { model: 'qwen-plus' } } as never)
    const res = await callPatch({ config: { model: 'qwen-plus', temperature: 0.7, agentMode: 'react', maxIterations: 5 } })
    expect(res.status).toBe(200)
    expect(mockSave).toHaveBeenCalledWith(adminCtx, ID, expect.objectContaining({
      config: { model: 'qwen-plus', temperature: 0.7, agentMode: 'react', maxIterations: 5 },
    }))
  })

  it('非法 config（温度越界）→ 422，不触碰数据层', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await callPatch({ config: { temperature: 9 } })
    expect(res.status).toBe(422)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('目标不存在 / 跨租户（saveAgent=null）→ 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockSave.mockResolvedValueOnce(null)
    const res = await callPatch({ name: '改名' })
    expect(res.status).toBe(404)
  })
})
