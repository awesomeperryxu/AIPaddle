import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.1.25 Agent 定时作业 API 单测

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/auth/permissions', () => ({ can: vi.fn() }))
vi.mock('@/lib/data/agent-schedules', () => ({
  listSchedules: vi.fn().mockResolvedValue([]),
  createSchedule: vi.fn().mockResolvedValue({
    id: 's1', agentId: 'a1', agentName: 'TestAgent',
    cronExpr: '0 9 * * *', triggerPrompt: '汇总数据',
    isEnabled: true, nextRunAt: null, lastRunAt: null,
    lastStatus: null, consecutiveFailures: 0, createdAt: '2026-07-26T00:00:00Z',
  }),
  updateSchedule: vi.fn().mockResolvedValue(undefined),
  deleteSchedule: vi.fn().mockResolvedValue(undefined),
  listScheduleRuns: vi.fn().mockResolvedValue([]),
}))

import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createSchedule } from '@/lib/data/agent-schedules'
import { GET, POST } from '@/app/api/agent-schedules/route'
import { PATCH, DELETE } from '@/app/api/agent-schedules/[id]/route'
import { GET as GETRuns } from '@/app/api/agent-schedules/[id]/runs/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCan = vi.mocked(can)
const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] as const }

const makeReq = (url: string, method: string, body?: unknown) =>
  new Request(url, { method, body: body ? JSON.stringify(body) : undefined })

const idParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/agent-schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('已登录 → 返回列表', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { schedules: unknown[] }
    expect(Array.isArray(body.schedules)).toBe(true)
  })
})

describe('POST /api/agent-schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await POST(makeReq('http://localhost/', 'POST', {}))).status).toBe(401)
  })

  it('无权限 → 403', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(false)
    expect((await POST(makeReq('http://localhost/', 'POST', {}))).status).toBe(403)
  })

  it('缺少必填字段 → 400', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(true)
    const res = await POST(makeReq('http://localhost/', 'POST', { agentId: 'a1' }))
    expect(res.status).toBe(400)
  })

  it('正常创建 → 201', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(true)
    const res = await POST(makeReq('http://localhost/', 'POST', {
      agentId: 'a1', cronExpr: '0 9 * * *', triggerPrompt: '汇总数据',
    }))
    expect(res.status).toBe(201)
    expect(vi.mocked(createSchedule)).toHaveBeenCalledOnce()
  })

  it('unique 冲突 → 409', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(true)
    vi.mocked(createSchedule).mockRejectedValueOnce(new Error('unique constraint'))
    const res = await POST(makeReq('http://localhost/', 'POST', {
      agentId: 'a1', cronExpr: '0 9 * * *', triggerPrompt: '汇总数据',
    }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/agent-schedules/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await PATCH(makeReq('http://localhost/', 'PATCH', {}), idParams('s1'))
    expect(res.status).toBe(401)
  })

  it('切换 isEnabled → 200', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(true)
    const res = await PATCH(
      makeReq('http://localhost/', 'PATCH', { isEnabled: false }),
      idParams('s1'),
    )
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/agent-schedules/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await DELETE(makeReq('http://localhost/', 'DELETE'), idParams('s1'))
    expect(res.status).toBe(401)
  })

  it('有权限 → 200', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    mockCan.mockReturnValue(true)
    const res = await DELETE(makeReq('http://localhost/', 'DELETE'), idParams('s1'))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/agent-schedules/[id]/runs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await GETRuns(makeReq('http://localhost/', 'GET'), idParams('s1'))
    expect(res.status).toBe(401)
  })

  it('已登录 → 返回 runs 列表', async () => {
    mockCtx.mockResolvedValue(ctx as never)
    const res = await GETRuns(makeReq('http://localhost/', 'GET'), idParams('s1'))
    expect(res.status).toBe(200)
    const body = await res.json() as { runs: unknown[] }
    expect(Array.isArray(body.runs)).toBe(true)
  })
})
