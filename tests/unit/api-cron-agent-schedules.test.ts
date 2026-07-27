import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.1.26 Cron 执行端单测

vi.mock('@/lib/data/agent-schedules-admin', () => ({
  listDueSchedules: vi.fn(),
  createRun: vi.fn().mockResolvedValue('run-1'),
  updateRun: vi.fn().mockResolvedValue(undefined),
  updateScheduleAfterRun: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/agents/cron-invoke', () => ({
  invokeCronAgent: vi.fn(),
}))

import { listDueSchedules, createRun, updateRun, updateScheduleAfterRun } from '@/lib/data/agent-schedules-admin'
import { invokeCronAgent } from '@/lib/agents/cron-invoke'
import { POST } from '@/app/api/cron/agent-schedules/route'

const makeReq = (secret?: string) =>
  new Request('http://localhost/api/cron/agent-schedules', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })

const sched = {
  id: 's1', org_id: 'o1', agent_id: 'a1',
  cron_expr: '0 9 * * *', trigger_prompt: '汇总数据', consecutive_failures: 0,
}

describe('POST /api/cron/agent-schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('CRON_SECRET 不匹配 → 401', async () => {
    const res = await POST(makeReq('wrong'))
    expect(res.status).toBe(401)
  })

  it('无到期 schedules → processed=0', async () => {
    vi.mocked(listDueSchedules).mockResolvedValue([])
    const res = await POST(makeReq('test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json() as { processed: number }
    expect(body.processed).toBe(0)
  })

  it('有到期 schedule 且调用成功 → processed=1, status=success', async () => {
    vi.mocked(listDueSchedules).mockResolvedValue([sched])
    vi.mocked(invokeCronAgent).mockResolvedValue({ reply: '已完成汇总' })
    const res = await POST(makeReq('test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json() as { processed: number; results: { status: string }[] }
    expect(body.processed).toBe(1)
    expect(body.results[0].status).toBe('success')
    expect(vi.mocked(updateRun)).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'success' }))
    expect(vi.mocked(updateScheduleAfterRun)).toHaveBeenCalledWith('s1', true, expect.any(String))
  })

  it('调用失败 → status=error，updateScheduleAfterRun(false)', async () => {
    vi.mocked(listDueSchedules).mockResolvedValue([sched])
    vi.mocked(invokeCronAgent).mockRejectedValue(new Error('LLM timeout'))
    const res = await POST(makeReq('test-secret'))
    const body = await res.json() as { results: { status: string }[] }
    expect(body.results[0].status).toBe('error')
    expect(vi.mocked(updateScheduleAfterRun)).toHaveBeenCalledWith('s1', false, expect.any(String))
  })

  it('DB 查询失败 → 500', async () => {
    vi.mocked(listDueSchedules).mockRejectedValue(new Error('DB error'))
    const res = await POST(makeReq('test-secret'))
    expect(res.status).toBe(500)
  })

  it('无 CRON_SECRET 环境变量时放行所有请求', async () => {
    process.env.CRON_SECRET = ''
    vi.mocked(listDueSchedules).mockResolvedValue([])
    const res = await POST(makeReq()) // no auth header
    expect(res.status).toBe(200)
  })
})
