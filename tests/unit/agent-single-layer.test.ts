/**
 * L3 · 普通 Agent 单层约束（V12-2.9 / ADR-019 / AC-06）
 *
 * D-08 约束的是**普通 Agent 这一层**——它必须保持单层。
 * 数字员工是被允许的上一级（正因如此才能组合多个 Agent 并经 Workflow 串联）。
 *
 * 两者共用同一个 resources 接口，服务端无从分辨请求来自哪个页面，
 * 于是普通 Agent 的编排页也能提交 subAgentIds = 绕过 D-08。
 * 修法是要求调用方声明来源，**缺省按最严处理**。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({
  getAgentResources: vi.fn(), setAgentResources: vi.fn(),
}))
vi.mock('@/lib/data/agents', () => ({ listAgents: vi.fn(), getAgentById: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { getAgentResources, setAgentResources } from '@/lib/data/agent-resources'
import { listAgents, getAgentById } from '@/lib/data/agents'
import { PUT } from '@/app/api/agents/[id]/resources/route'

const mockCtx = vi.mocked(getRequestContext)
const admin: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const SELF = '11111111-1111-1111-1111-111111111111'
const SUB = '22222222-2222-2222-2222-222222222222'

const put = (body: unknown) =>
  PUT(
    new Request('http://x', { method: 'PUT', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: SELF }) },
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(admin)
  vi.mocked(getAgentById).mockResolvedValue({ id: SELF, name: '本体' } as never)
  vi.mocked(listAgents).mockResolvedValue([
    { id: SUB, name: '子', status: 'published' },
  ] as never)
  vi.mocked(getAgentResources).mockResolvedValue({
    knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [],
  })
  vi.mocked(setAgentResources).mockResolvedValue({
    knowledgeBaseIds: [], skillIds: [], mcpServerIds: [], subAgentIds: [],
  })
})

describe('普通 Agent 入口（AC-06）', () => {
  it('🔴 不声明来源时提交 subAgentIds → 422（缺省按最严）', async () => {
    const res = await put({ subAgentIds: [SUB] })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('sub_agent_not_allowed')
    expect(setAgentResources, '不应写入数据层').not.toHaveBeenCalled()
  })

  it('🔴 显式声明 source=agent 时同样拒绝', async () => {
    const res = await put({ source: 'agent', subAgentIds: [SUB] })
    expect(res.status).toBe(422)
  })

  it('🔴 伪造未知 source 值不能绕过（只认白名单）', async () => {
    for (const bad of ['Digital-Employee', 'de', 'admin', '', null, 123, {}]) {
      const res = await put({ source: bad, subAgentIds: [SUB] })
      expect(res.status, `source=${JSON.stringify(bad)} 应被拒`).toBe(422)
    }
  })

  it('错误信息指明去哪儿做，而不只是说不允许', async () => {
    const msg = (await (await put({ subAgentIds: [SUB] })).json()).error.message
    expect(msg).toMatch(/数字员工/)
    expect(msg).toMatch(/D-08/)
  })

  it('不带 subAgentIds 时正常保存其它资源（不误伤）', async () => {
    const res = await put({ knowledgeBaseIds: [], skillIds: [], mcpServerIds: [] })
    expect(res.status).toBe(200)
    expect(setAgentResources).toHaveBeenCalled()
  })
})

describe('数字员工入口', () => {
  it('声明 source=digital-employee 可提交子 Agent', async () => {
    const res = await put({ source: 'digital-employee', subAgentIds: [SUB] })
    expect(res.status).toBe(200)
    expect(setAgentResources).toHaveBeenCalledWith(
      admin, SELF, expect.objectContaining({ subAgentIds: [SUB] }),
    )
  })

  it('🔴 source 只能收紧不能放宽——声明为数字员工仍要过深度校验', async () => {
    // 候选本身是数字员工（已挂下级）→ 深度会超 1 层，须拒
    vi.mocked(getAgentResources).mockResolvedValue({
      knowledgeBaseIds: [], skillIds: [], mcpServerIds: [],
      subAgentIds: ['33333333-3333-3333-3333-333333333333'],
    })
    const res = await put({ source: 'digital-employee', subAgentIds: [SUB] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subAgentRejected?.[0]?.reason, '应因嵌套超限被拒').toMatch(/嵌套/)
    // 被拒的不应写进资源
    expect(setAgentResources).toHaveBeenCalledWith(
      admin, SELF, expect.objectContaining({ subAgentIds: [] }),
    )
  })

  it('🔴 自引用仍被拒', async () => {
    const res = await put({ source: 'digital-employee', subAgentIds: [SELF] })
    const body = await res.json()
    expect(body.subAgentRejected?.[0]?.reason).toMatch(/自己/)
  })

  it('🔴 无权使用的 Agent 仍被拒（不信前端传的 id）', async () => {
    vi.mocked(listAgents).mockResolvedValue([])   // 授权集为空
    const res = await put({ source: 'digital-employee', subAgentIds: [SUB] })
    const body = await res.json()
    expect(body.subAgentRejected?.[0]?.reason).toMatch(/无权/)
  })
})
