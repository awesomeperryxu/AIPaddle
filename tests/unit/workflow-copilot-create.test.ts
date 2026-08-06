/**
 * L3 测试 · WF-1 描述 → 一次性建出已填好流程的工作流
 *
 * 用户反馈「打开编辑器里面什么都没有」。排查发现生成链路是通的，但分成
 * copilot → POST /workflows → PATCH graph 三次调用，中途任一步失败都会
 * 留下一条空白工作流——正是用户看到的现象。本端点把三步合一，失败即不产出。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/workflow/copilot', () => ({ generateWorkflowGraph: vi.fn() }))
vi.mock('@/lib/data/workflow', () => ({ createWorkflow: vi.fn(), saveWorkflow: vi.fn() }))
// WF-3 起端点会取「本租户已发布 Skill」作为 Copilot 的能力清单，不 mock 会真去连库
vi.mock('@/lib/data/skills', () => ({ listSkills: vi.fn() }))
vi.mock('@/lib/workflow/validate-tools', () => ({ validateToolNodes: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'
import { createWorkflow, saveWorkflow } from '@/lib/data/workflow'
import { listSkills } from '@/lib/data/skills'
import { validateToolNodes } from '@/lib/workflow/validate-tools'
import { writeAudit } from '@/lib/data/audit'
import { POST } from '@/app/api/workflows/copilot/create/route'

const mockCtx = vi.mocked(getRequestContext)
const mockGen = vi.mocked(generateWorkflowGraph)
const mockCreate = vi.mocked(createWorkflow)
const mockSave = vi.mocked(saveWorkflow)
const mockToolCheck = vi.mocked(validateToolNodes)
const mockSkills = vi.mocked(listSkills)
const mockAudit = vi.mocked(writeAudit)

const dev: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Developer'] }
const plain: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }

// 与实测生成结果同形（start → llm → llm → if-else → 两个 end）
const graph = {
  nodes: [
    { id: 'start_1', type: 'start', label: '每日定时触发' },
    { id: 'llm_2', type: 'llm', label: '检索昨日AI大事件' },
    { id: 'end_3', type: 'end', label: '输出' },
  ],
  edges: [{ source: 'start_1', target: 'llm_2' }, { source: 'llm_2', target: 'end_3' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGen.mockResolvedValue({ graph, validation: [], valid: true })
  mockCreate.mockResolvedValue({ id: 'w1', name: 'x' } as never)
  mockSave.mockResolvedValue({ id: 'w1', name: 'x', graph } as never)
  mockToolCheck.mockResolvedValue([])
  mockSkills.mockResolvedValue([])
})

const req = (b: unknown) =>
  new Request('http://localhost/api/workflows/copilot/create', { method: 'POST', body: JSON.stringify(b) })

const DESC = '我需要创建一个查找全网当天AI相关的大事件的workflow，并设置为每天早上8点运行'

describe('门控', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await POST(req({ description: DESC }))).status).toBe(401)
  })

  it('403 无 workflow:create，且不触发生成（生成要花钱）', async () => {
    mockCtx.mockResolvedValue(plain)
    expect((await POST(req({ description: DESC }))).status).toBe(403)
    expect(mockGen).not.toHaveBeenCalled()
  })

  it('400 描述为空', async () => {
    mockCtx.mockResolvedValue(dev)
    expect((await POST(req({ description: '  ' }))).status).toBe(400)
    expect(mockGen).not.toHaveBeenCalled()
  })
})

describe('生成失败不留残骸', () => {
  // 🔴 这正是用户遇到的现象：壳建出来了、流程没进去
  it('生成不出节点 → 422 且**不建工作流**', async () => {
    mockCtx.mockResolvedValue(dev)
    mockGen.mockResolvedValue({ graph: { nodes: [], edges: [] }, validation: [], valid: false })
    const res = await POST(req({ description: DESC }))
    expect(res.status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('存图失败 → 500，不谎称成功', async () => {
    mockCtx.mockResolvedValue(dev)
    mockSave.mockResolvedValue(null)
    expect((await POST(req({ description: DESC }))).status).toBe(500)
  })
})

describe('成功路径', () => {
  it('201 返回已落库的工作流 + 校验结论', async () => {
    mockCtx.mockResolvedValue(dev)
    const res = await POST(req({ description: DESC }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.workflow.id).toBe('w1')
    expect(body.valid).toBe(true)
    // 图必须真的存进去，否则用户刷新就没了
    expect(mockSave).toHaveBeenCalledWith(dev, 'w1', { graph })
  })

  it('校验以**落库后**的图为准，不是生成时的内存对象', async () => {
    mockCtx.mockResolvedValue(dev)
    const savedGraph = { nodes: graph.nodes, edges: [] } // 模拟保存过程对图做了规整
    mockSave.mockResolvedValue({ id: 'w1', name: 'x', graph: savedGraph } as never)
    await POST(req({ description: DESC }))
    expect(mockToolCheck).toHaveBeenCalledWith(dev, savedGraph)
  })

  it('名称从描述提炼，去掉「我需要创建一个」这类口语开头', async () => {
    mockCtx.mockResolvedValue(dev)
    await POST(req({ description: DESC }))
    const name = mockCreate.mock.calls[0][1].name
    expect(name).not.toMatch(/^我需要/)
    expect(name).toContain('查找全网当天AI相关的大事件')
    expect(name.length).toBeLessThanOrEqual(41)
  })

  it('落审计，记节点数与校验结论', async () => {
    mockCtx.mockResolvedValue(dev)
    await POST(req({ description: DESC }))
    expect(mockAudit).toHaveBeenCalledWith(
      dev, 'workflow.copilot_created', 'workflow', 'w1',
      expect.objectContaining({ nodeCount: 3, valid: true }),
    )
  })
})
