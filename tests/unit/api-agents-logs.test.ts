/**
 * L3 集成测试 · app/api/agents/[id]/logs（调用日志查询，4.1.5）
 *   1. Admin/Auditor（audit:read）→ 200 { logs, count }
 *   2. 无 audit:read（User）→ 403；未登录 → 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/call-logs', () => ({
  listCallLogsByAgent: vi.fn(),
  countCallsByAgent: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { listCallLogsByAgent, countCallsByAgent } from '@/lib/data/call-logs'
import { GET } from '@/app/api/agents/[id]/logs/route'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listCallLogsByAgent)
const mockCount = vi.mocked(countCallsByAgent)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'

function call() {
  return GET(new Request(`http://localhost/api/agents/${ID}/logs`), { params: Promise.resolve({ id: ID }) })
}

describe('GET /api/agents/[id]/logs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call()).status).toBe(401)
  })

  it('无 audit:read（User）→ 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call()).status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })

  it('Admin → 200 { logs, count }', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockList.mockResolvedValueOnce([
      { id: 'l1', agentId: ID, model: 'qwen-plus', tokensIn: 30, tokensOut: 12, latencyMs: 800, success: true, errorCode: null, createdAt: '2026-07-21' },
    ])
    mockCount.mockResolvedValueOnce(1)
    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
    expect(body.logs).toHaveLength(1)
    expect(body.logs[0].model).toBe('qwen-plus')
  })
})
