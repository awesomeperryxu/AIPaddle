/**
 * L3 集成测试 · app/api/agents/[id]/transition（状态机流转，4.1.2）
 *   1. 合法流转（Admin submit：draft→pending）→ 200
 *   2. 非法流转（当前态不匹配）→ 409
 *   3. 无权限角色 → 403
 *   4. 未登录 → 401；未知动作 → 400；不存在 → 404
 * + 状态机纯逻辑：TRANSITIONS 合法集 + actionsFor。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ transitionAgent: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { transitionAgent } from '@/lib/data/agents'
import { POST } from '@/app/api/agents/[id]/transition/route'
import { TRANSITIONS, actionsFor } from '@/lib/agents/status'

const mockCtx = vi.mocked(getRequestContext)
const mockTransition = vi.mocked(transitionAgent)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const auditorCtx: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'

function call(action: string) {
  return POST(
    new Request(`http://localhost/api/agents/${ID}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id: ID }) },
  )
}

describe('POST /api/agents/[id]/transition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call('submit')).status).toBe(401)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('未知动作 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await call('publish-now')).status).toBe(400)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('无权限：User 提交审核 → 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call('submit')).status).toBe(403)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('无权限：Developer 无 agent:review，approve → 403', async () => {
    mockCtx.mockResolvedValueOnce({ userId: 'u2', orgId: 'org1', roles: ['Developer'] })
    expect((await call('approve')).status).toBe(403)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('合法：Admin submit（draft→pending）→ 200', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockTransition.mockResolvedValueOnce({ ok: true, agent: { id: ID, status: 'pending' } as never })
    const res = await call('submit')
    expect(res.status).toBe(200)
    expect((await res.json()).agent.status).toBe('pending')
    expect(mockTransition).toHaveBeenCalledWith(adminCtx, ID, 'submit')
  })

  it('合法：Auditor approve → 200', async () => {
    mockCtx.mockResolvedValueOnce(auditorCtx)
    mockTransition.mockResolvedValueOnce({ ok: true, agent: { id: ID, status: 'published' } as never })
    expect((await call('approve')).status).toBe(200)
  })

  it('非法流转（reason=illegal）→ 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockTransition.mockResolvedValueOnce({ ok: false, reason: 'illegal' })
    expect((await call('approve')).status).toBe(409)
  })

  it('目标不存在 / 跨租户（reason=not_found）→ 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockTransition.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    expect((await call('submit')).status).toBe(404)
  })
})

describe('状态机 TRANSITIONS 纯逻辑', () => {
  it('只有 5 条合法流转，且主链 draft→pending→published→offline 连通', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(['approve', 'offline', 'online', 'reject', 'submit'])
    expect(TRANSITIONS.submit).toMatchObject({ from: 'draft', to: 'pending' })
    expect(TRANSITIONS.approve).toMatchObject({ from: 'pending', to: 'published' })
    expect(TRANSITIONS.offline).toMatchObject({ from: 'published', to: 'offline' })
  })

  it('actionsFor 按当前态给出可用动作', () => {
    expect(actionsFor('draft')).toEqual(['submit'])
    expect(actionsFor('pending').sort()).toEqual(['approve', 'reject'])
    expect(actionsFor('published')).toEqual(['offline'])
    expect(actionsFor('offline')).toEqual(['online'])
  })
})
