/**
 * L3 · app/api/agents/copilot（Agent Copilot，4.1.6 + BUG-100 修复）
 *   1. 生成成功 → 201，落 draft（createAgent 强制 draft，AI 不能发布）+ 审计 + 自动关联知识库
 *   2. 生成/校验失败 → 422；描述过短 → 400；无权限 → 403；未登录 → 401
 *   3. extractJson 容错 + AgentDraftSchema 校验
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ createAgent: vi.fn() }))
vi.mock('@/lib/data/agent-resources', () => ({ setAgentResources: vi.fn() }))
vi.mock('@/lib/data/knowledge', () => ({ listKnowledgeBases: vi.fn() }))
vi.mock('@/lib/data/skills', () => ({ listSkills: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/agents/copilot', async (orig) => ({
  ...(await orig<typeof import('@/lib/agents/copilot')>()),
  generateCopilotRaw: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { createAgent } from '@/lib/data/agents'
import { setAgentResources } from '@/lib/data/agent-resources'
import { listKnowledgeBases } from '@/lib/data/knowledge'
import { listSkills } from '@/lib/data/skills'
import { writeAudit } from '@/lib/data/audit'
import { generateCopilotRaw, extractJson, AgentDraftSchema } from '@/lib/agents/copilot'
import { POST } from '@/app/api/agents/copilot/route'

const mockCtx = vi.mocked(getRequestContext)
const mockCreate = vi.mocked(createAgent)
const mockSetResources = vi.mocked(setAgentResources)
const mockListKb = vi.mocked(listKnowledgeBases)
const mockListSkills = vi.mocked(listSkills)
const mockAudit = vi.mocked(writeAudit)
const mockGen = vi.mocked(generateCopilotRaw)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }

function call(description: unknown) {
  return POST(new Request('http://localhost/api/agents/copilot', { method: 'POST', body: JSON.stringify({ description }) }))
}

// 新版 generateCopilotRaw 返回的格式（包含 name/description + suggestKbIds）
const rawResult = {
  name: 'RoyalBlack Customer Service',
  department: '客服部',
  description: '连接 royalblack-hotel.com 官网 AI 客服',
  systemPrompt: '你是黑围裙的在线客服顾问，负责接待官网咨询。',
  suggestKbIds: ['kb-1'],
  suggestSkillIds: [],
  reply: '已创建客服 Agent 并关联知识库',
}

describe('POST /api/agents/copilot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认返回值，个别测试会覆盖
    mockListKb.mockResolvedValue([{ id: 'kb-1', name: 'Royalblack-website' } as never])
    mockListSkills.mockResolvedValue([])
  })

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
    mockGen.mockRejectedValueOnce(new Error('LLM 超时'))
    expect((await call('做一个处理售后的客服助手')).status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('成功 → 201，落 draft + 审计 + 自动关联知识库', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockGen.mockResolvedValueOnce(rawResult)
    mockCreate.mockResolvedValueOnce({ id: 'a1', status: 'draft', name: rawResult.name } as never)
    mockSetResources.mockResolvedValueOnce({} as never)

    const res = await call('创建一个 Agent 叫 RoyalBlack Customer Service，关联知识库 Royalblack-website')
    expect(res.status).toBe(201)

    // 传给 LLM 的授权清单包含了知识库
    expect(mockGen).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ id: 'kb-1', name: 'Royalblack-website' })]),
      expect.any(Array),
    )

    // Agent 名字是 LLM 返回的（应包含用户指定的名称）
    expect(mockCreate).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ name: rawResult.name }))

    // 自动关联了知识库
    expect(mockSetResources).toHaveBeenCalledWith(adminCtx, 'a1', expect.objectContaining({ knowledgeBaseIds: ['kb-1'] }))

    // 审计记录包含 suggestKbIds
    expect(mockAudit).toHaveBeenCalledWith(adminCtx, 'agent.copilot_create', 'agent', 'a1',
      expect.objectContaining({ suggestKbIds: ['kb-1'] }))

    // 返回的 Agent 是 draft 状态
    expect((await res.json()).agent.status).toBe('draft')
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
