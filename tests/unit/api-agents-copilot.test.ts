/**
 * L3 · app/api/agents/copilot（Agent Copilot，4.1.6）+ copilot 纯逻辑
 *   1. 生成成功 → 201，落 draft（createAgent 强制 draft，AI 不能发布）+ 审计
 *   2. 生成/校验失败 → 422；描述过短 → 400；无权限 → 403；未登录 → 401
 *   3. extractJson 容错 + AgentDraftSchema 校验
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ createAgent: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/agents/copilot', async (orig) => ({
  ...(await orig<typeof import('@/lib/agents/copilot')>()),
  generateAgentDraft: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { createAgent } from '@/lib/data/agents'
import { writeAudit } from '@/lib/data/audit'
import { generateAgentDraft, extractJson, AgentDraftSchema } from '@/lib/agents/copilot'
import { POST } from '@/app/api/agents/copilot/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCreate = vi.mocked(createAgent)
const mockAudit = vi.mocked(writeAudit)
const mockGen = vi.mocked(generateAgentDraft)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }

function call(description: unknown) {
  return POST(new Request('http://localhost/api/agents/copilot', { method: 'POST', body: JSON.stringify({ description }) }))
}

const draft = { name: '售后客服助手', department: '客服部', description: '处理售后投诉', systemPrompt: '你是耐心专业的售后客服。' }

describe('POST /api/agents/copilot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await call('做一个客服')).status).toBe(401)
  })

  it('无 agent:create（User）→ 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await call('做一个客服助手')).status).toBe(403)
    expect(mockGen).not.toHaveBeenCalled()
  })

  it('描述过短 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await call('客服')).status).toBe(400)
  })

  it('生成/校验失败 → 422', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockGen.mockRejectedValueOnce(new Error('schema 校验失败'))
    expect((await call('做一个处理售后的客服助手')).status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('成功 → 201，落 draft + 审计；AI 不触发发布', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockGen.mockResolvedValueOnce(draft)
    mockCreate.mockResolvedValueOnce({ id: 'a1', status: 'draft', name: draft.name } as never)
    const res = await call('做一个处理售后投诉的客服助手')
    expect(res.status).toBe(201)
    // createAgent 收到 systemPrompt，且返回 draft（无发布动作）
    expect(mockCreate).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ name: draft.name, systemPrompt: draft.systemPrompt }))
    expect((await res.json()).agent.status).toBe('draft')
    expect(mockAudit).toHaveBeenCalledWith(adminCtx, 'agent.copilot_create', 'agent', 'a1', expect.any(Object))
  })
})

describe('copilot 纯逻辑', () => {
  it('extractJson 容忍 ```json 围栏与前后噪声', () => {
    expect(extractJson('```json\n{"name":"x"}\n```')).toEqual({ name: 'x' })
    expect(extractJson('好的，配置如下：{"a":1} 完成')).toEqual({ a: 1 })
    expect(() => extractJson('没有 json')).toThrow()
  })

  it('AgentDraftSchema 校验必填 name/systemPrompt', () => {
    expect(AgentDraftSchema.safeParse({ name: 'x', systemPrompt: '你是助手' }).success).toBe(true)
    expect(AgentDraftSchema.safeParse({ name: '', systemPrompt: '你是助手' }).success).toBe(false)
    expect(AgentDraftSchema.safeParse({ name: 'x' }).success).toBe(false)
  })
})
