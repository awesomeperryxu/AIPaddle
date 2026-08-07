/**
 * L3 测试 · WF-6 助理分步编排（建流程 → 发布 → 建 Agent → 发布 → 配定时）
 *
 * 🔴 核心安全边界：自动化只做「步骤衔接」，不替人做「是否放行」的判断。
 * 无 agent:review 权限时必须停在 pending 交人审，绝不因为「流程要顺畅」而绕过审核。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/assistant/orchestrate', () => ({
  draftWorkflow: vi.fn(), publishWorkflowAndDraftAgent: vi.fn(),
}))
vi.mock('@/lib/data/agents', () => ({ transitionAgent: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { draftWorkflow, publishWorkflowAndDraftAgent } from '@/lib/assistant/orchestrate'
import { transitionAgent } from '@/lib/data/agents'
import { POST } from '@/app/api/assistant/orchestrate/route'

const mockCtx = vi.mocked(getRequestContext)
const mockDraft = vi.mocked(draftWorkflow)
const mockPublishWf = vi.mocked(publishWorkflowAndDraftAgent)
const mockTransition = vi.mocked(transitionAgent)

// Admin 有 agent:review；Developer 无（ADR-007 矩阵）
const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const dev: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['Developer'] }
const plain: RequestContext = { userId: 'u3', orgId: 'o1', roles: ['User'] }

const DESC = '每天早上8点查找全网AI大事件'
const req = (b: unknown) =>
  new Request('http://localhost/api/assistant/orchestrate', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockDraft.mockResolvedValue({
    workflowId: 'w1', name: '查找全网AI大事件', nodeCount: 4, edgeCount: 3,
    nodes: [], pendingAbilityNodes: [], validation: [], valid: true,
  })
  mockPublishWf.mockResolvedValue({
    agentId: 'a1', agentName: '查找全网AI大事件 · 定时执行', workflowId: 'w1', workflowName: '查找全网AI大事件',
  })
  mockTransition.mockResolvedValue({ ok: true, agent: { id: 'a1' } } as never)
})

describe('步骤① 生成工作流草稿', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await POST(req({ step: 'draft-workflow', description: DESC }))).status).toBe(401)
  })

  it('403 无 workflow:create，且不触发生成（生成要花钱）', async () => {
    mockCtx.mockResolvedValue(plain)
    expect((await POST(req({ step: 'draft-workflow', description: DESC }))).status).toBe(403)
    expect(mockDraft).not.toHaveBeenCalled()
  })

  it('400 描述为空', async () => {
    mockCtx.mockResolvedValue(dev)
    expect((await POST(req({ step: 'draft-workflow', description: '  ' }))).status).toBe(400)
  })

  it('201 返回草稿供确认（此时尚未发布任何东西）', async () => {
    mockCtx.mockResolvedValue(dev)
    const res = await POST(req({ step: 'draft-workflow', description: DESC }))
    expect(res.status).toBe(201)
    const b = await res.json()
    expect(b.draft.workflowId).toBe('w1')
    expect(b.draft.nodeCount).toBe(4)
  })
})

describe('步骤②③ 发布工作流并建 Agent', () => {
  it('403 缺 agent:create 时不发布工作流——避免卡在「流程已发布但没 Agent」', async () => {
    mockCtx.mockResolvedValue(plain)
    expect((await POST(req({ step: 'publish-workflow', workflowId: 'w1', description: DESC }))).status).toBe(403)
    expect(mockPublishWf).not.toHaveBeenCalled()
  })

  it('201 发布并返回 Agent 草稿', async () => {
    mockCtx.mockResolvedValue(admin)
    const res = await POST(req({ step: 'publish-workflow', workflowId: 'w1', description: DESC }))
    expect(res.status).toBe(201)
    expect((await res.json()).agent.agentId).toBe('a1')
  })

  it('校验未过则整步失败（不带着结构错误上线）', async () => {
    mockCtx.mockResolvedValue(admin)
    mockPublishWf.mockRejectedValue(new Error('工作流校验未通过，无法发布：存在孤立节点'))
    const res = await POST(req({ step: 'publish-workflow', workflowId: 'w1', description: DESC }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toContain('校验未通过')
  })
})

describe('步骤④ 发布 Agent —— 审核边界', () => {
  it('有审核权限 → draft→pending→published 一次做完', async () => {
    mockCtx.mockResolvedValue(admin)
    const res = await POST(req({ step: 'publish-agent', agentId: 'a1' }))
    const b = await res.json()
    expect(b.status).toBe('published')
    expect(b.pendingReview).toBe(false)
    expect(mockTransition).toHaveBeenCalledTimes(2)
    expect(mockTransition.mock.calls.map((c) => c[2])).toEqual(['submit', 'approve'])
  })

  // 🔴 这条是本次改动的安全底线
  it('无审核权限 → 停在 pending，绝不自动通过', async () => {
    mockCtx.mockResolvedValue(dev)
    const res = await POST(req({ step: 'publish-agent', agentId: 'a1' }))
    const b = await res.json()
    expect(b.status).toBe('pending')
    expect(b.pendingReview).toBe(true)
    // 只提交，不批准
    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockTransition.mock.calls[0][2]).toBe('submit')
  })

  it('403 连提交权限都没有', async () => {
    mockCtx.mockResolvedValue(plain)
    expect((await POST(req({ step: 'publish-agent', agentId: 'a1' }))).status).toBe(403)
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('409 状态不允许流转', async () => {
    mockCtx.mockResolvedValue(admin)
    mockTransition.mockResolvedValue({ ok: false, reason: 'illegal' } as never)
    expect((await POST(req({ step: 'publish-agent', agentId: 'a1' }))).status).toBe(409)
  })
})

describe('未知步骤', () => {
  it('400 拒绝未知 step', async () => {
    mockCtx.mockResolvedValue(admin)
    expect((await POST(req({ step: 'delete-everything' }))).status).toBe(400)
  })
})
