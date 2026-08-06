/**
 * L3 测试 · WF-5 定时触发必须走 Agent 的大脑分流
 *
 * 🔴 原缺陷：invokeCronAgent 只调 LLM、完全没看 brainMode。于是「Agent 绑了工作流
 * + 配了定时」看着一切正常（有触发、有执行记录、有输出），实际跑的是模型自由发挥，
 * 工作流从未被执行。比报错危险——静默走偏要比对工作流日志才能察觉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const from = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))
vi.mock('@/lib/ai', () => ({ chat: vi.fn() }))
vi.mock('@/lib/workflow/execute', () => ({ executeGraph: vi.fn() }))

import { chat } from '@/lib/ai'
import { executeGraph } from '@/lib/workflow/execute'
import { invokeCronAgent } from '@/lib/agents/cron-invoke'

const mockChat = vi.mocked(chat)
const mockExec = vi.mocked(executeGraph)

/** 构造 supabase 链式调用桩：agents 与 workflows 各返回一行 */
function stubTables(agentRow: unknown, workflowRow: unknown = null) {
  from.mockImplementation((table: string) => {
    const row = table === 'agents' ? agentRow : workflowRow
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain,
      maybeSingle: async () => ({ data: row, error: null }),
    }
    return chain
  })
}

const baseAgent = (config: Record<string, unknown>) => ({
  id: 'a1', name: '测试助手', status: 'published', config,
})
const graph = { nodes: [{ id: 'n1', type: 'start' }], edges: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockChat.mockResolvedValue('LLM 的回答')
  mockExec.mockResolvedValue({ status: 'succeeded', output: '工作流的输出', traces: [] } as never)
})

const call = () => invokeCronAgent({ agentId: 'a1', orgId: 'o1', triggerPrompt: '开始吧' })

describe('workflow 大脑', () => {
  it('绑定工作流时执行 executeGraph，而不是直接调 LLM', async () => {
    stubTables(baseAgent({ brainMode: 'workflow', brainWorkflowId: 'w1' }), { id: 'w1', name: '日报流程', graph })
    const r = await call()
    expect(r.brain).toBe('workflow')
    expect(r.reply).toBe('工作流的输出')
    expect(mockExec).toHaveBeenCalled()
    // 🔴 核心：不能再退回纯 LLM
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('工作流不存在 → 明确报错，不悄悄退回 LLM', async () => {
    stubTables(baseAgent({ brainMode: 'workflow', brainWorkflowId: 'w1' }), null)
    await expect(call()).rejects.toThrow(/不存在或已删除/)
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('空图 → 明确报错', async () => {
    stubTables(baseAgent({ brainMode: 'workflow', brainWorkflowId: 'w1' }), { id: 'w1', name: '空流程', graph: { nodes: [], edges: [] } })
    await expect(call()).rejects.toThrow(/是空的/)
  })

  it('执行失败 → 抛出失败节点的原因', async () => {
    stubTables(baseAgent({ brainMode: 'workflow', brainWorkflowId: 'w1' }), { id: 'w1', name: '日报流程', graph })
    mockExec.mockResolvedValue({
      status: 'failed', output: '',
      traces: [{ nodeId: 'n2', type: 'llm', status: 'failed', error: '模型超时', ms: 1 }],
    } as never)
    await expect(call()).rejects.toThrow(/模型超时/)
  })

  // 定时无用户会话 → 知识库/子 Agent 节点会被 executeGraph 跳过。
  // 必须让用户知道，否则「挂了知识库却总答不准」是个查不出原因的问题
  it('有节点被跳过 → 输出里明确标注，并回传节点清单', async () => {
    stubTables(baseAgent({ brainMode: 'workflow', brainWorkflowId: 'w1' }), { id: 'w1', name: '日报流程', graph })
    mockExec.mockResolvedValue({
      status: 'succeeded', output: '部分结果',
      traces: [
        { nodeId: 'kb1', type: 'knowledge-retrieval', status: 'skipped', error: '缺少运行上下文', ms: 1 },
        { nodeId: 'n2', type: 'llm', status: 'succeeded', ms: 1 },
      ],
    } as never)
    const r = await call()
    expect(r.skippedNodes).toEqual(['kb1'])
    expect(r.reply).toContain('kb1')
    expect(r.reply).toContain('跳过')
  })
})

describe('其它大脑模式', () => {
  it('llm（默认）→ 保持原行为', async () => {
    stubTables(baseAgent({ systemPrompt: '你是助手' }))
    const r = await call()
    expect(r.brain).toBe('llm')
    expect(r.reply).toBe('LLM 的回答')
    expect(mockExec).not.toHaveBeenCalled()
  })

  // 定时场景没有「用户这句话」可供关键词匹配，退回 LLM 会让用户以为按规则路由了
  it('routing → 明确报错而非悄悄退回 LLM', async () => {
    stubTables(baseAgent({ brainMode: 'routing' }))
    await expect(call()).rejects.toThrow(/事项路由/)
    expect(mockChat).not.toHaveBeenCalled()
  })
})

describe('前置校验', () => {
  it('未发布的 Agent 不可被定时调用', async () => {
    stubTables({ ...baseAgent({}), status: 'draft' })
    await expect(call()).rejects.toThrow(/draft/)
  })

  it('Agent 不存在 → 报错', async () => {
    stubTables(null)
    await expect(call()).rejects.toThrow(/不存在/)
  })
})
