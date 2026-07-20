/**
 * L3 集成测试 · app/api/agents（GET + POST）
 * 测四件事（docs/TESTING.md L3 约定）：
 *   1. 正常入参 → 正确结果
 *   2. 非法入参 → 4xx
 *   3. 无权限角色 → 403
 *   4. 未登录 → 401
 * 租户隔离（跨租户 → 404/403）需 Supabase 本地栈，由 3.7 专项脚本补充。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// ─── Mock 所有 server-side 依赖 ───────────────────────────────────────────────
vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({
  listAgents: vi.fn().mockResolvedValue({ agents: [], total: 0 }),
  getAgent: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-id', name: '测试 Agent', status: 'draft' },
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/agents/route'

const mockCtx = vi.mocked(getRequestContext)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const devCtx: RequestContext   = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
const userCtx: RequestContext  = { userId: 'u3', orgId: 'org1', roles: ['User'] }

function makeReq(url = 'http://localhost/api/agents', init?: RequestInit) {
  return new Request(url, init)
}

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/agents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('unauthenticated')
  })

  it('已登录（任意角色）→ 200 + agents 数组', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.agents)).toBe(true)
  })

  it('Admin 也可查询列表', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/agents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: '测试' }),
    }))
    expect(res.status).toBe(401)
  })

  it('User 角色 → 403（默认拒绝，ADR-007）', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: '测试' }),
    }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('forbidden')
  })

  it('Auditor 角色 → 403', async () => {
    mockCtx.mockResolvedValueOnce({ ...adminCtx, roles: ['Auditor'] })
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: '测试' }),
    }))
    expect(res.status).toBe(403)
  })

  it('名称为空 → 400', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid')
  })

  it('Developer 角色 + 有效名称 → 201', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: '新建 Agent', description: '测试描述' }),
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.agent).toBeDefined()
    expect(body.agent.status).toBe('draft')
  })

  it('Admin 角色 → 201', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    const res = await POST(new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Admin 创建的 Agent' }),
    }))
    expect(res.status).toBe(201)
  })
})
