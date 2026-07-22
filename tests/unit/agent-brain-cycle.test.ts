import { describe, it, expect, vi, beforeEach } from 'vitest'

// 4.1.9 防环：detectBrainCycle

vi.mock('@/lib/data/workflow', () => ({ getWorkflow: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ getAgentDetail: vi.fn() }))

import { getWorkflow } from '@/lib/data/workflow'
import { getAgentDetail } from '@/lib/data/agents'
import { detectBrainCycle } from '@/lib/agents/brain'

const mockWf = vi.mocked(getWorkflow)
const mockAgent = vi.mocked(getAgentDetail)
const ctx = { userId: 'u', orgId: 'o', roles: ['Admin'] } as never

const wf = (nodes: unknown[]) => ({ id: 'w', name: 'W', type: 'workflow', status: 'draft', version: 1, updatedAt: '', graph: { nodes, edges: [] } }) as never
const agentNode = (agentId: string) => ({ id: 'n', type: 'agent', data: { config: { agentId } } })

describe('detectBrainCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('工作流无 Agent 节点 → 无环', async () => {
    mockWf.mockResolvedValueOnce(wf([{ id: 's', type: 'start' }, { id: 'l', type: 'llm' }]))
    expect(await detectBrainCycle(ctx, 'A', 'w1')).toBe(false)
  })

  it('工作流含指向起点 Agent 的节点 → 直接成环', async () => {
    mockWf.mockResolvedValueOnce(wf([agentNode('A')]))
    expect(await detectBrainCycle(ctx, 'A', 'w1')).toBe(true)
  })

  it('传递成环：A→W1→(Agent节点B)→B.brain=W2→(Agent节点A) → 成环', async () => {
    // 第一次 getWorkflow(w1) 返回含 B 的节点
    mockWf.mockResolvedValueOnce(wf([agentNode('B')]))
    // B 的大脑是 w2
    mockAgent.mockResolvedValueOnce({ id: 'B', name: 'B', department: '', description: '', status: 'draft', config: { brainWorkflowId: 'w2' } } as never)
    // 第二次 getWorkflow(w2) 返回含 A 的节点 → 回到起点
    mockWf.mockResolvedValueOnce(wf([agentNode('A')]))
    expect(await detectBrainCycle(ctx, 'A', 'w1')).toBe(true)
  })

  it('引用别的 Agent 但不回起点 → 无环', async () => {
    mockWf.mockResolvedValueOnce(wf([agentNode('B')]))
    mockAgent.mockResolvedValueOnce({ id: 'B', name: 'B', department: '', description: '', status: 'draft', config: {} } as never) // B 无大脑工作流
    expect(await detectBrainCycle(ctx, 'A', 'w1')).toBe(false)
  })

  it('工作流不存在 → 无环', async () => {
    mockWf.mockResolvedValueOnce(null)
    expect(await detectBrainCycle(ctx, 'A', 'wX')).toBe(false)
  })
})
