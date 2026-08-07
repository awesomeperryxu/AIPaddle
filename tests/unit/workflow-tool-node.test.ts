/**
 * L2 测试 · Workflow tool 节点的参数构造与调用前置校验（WF-22）
 *
 * 背景：WF-3 让 Copilot 能把已发布 Skill 编排成 tool 节点，但执行引擎的白名单里
 * 没有 'tool'，跑到就 skipped 透传——「查全网 AI 大事件」即使挂了检索能力，
 * 数据也从没进过流程，下游 LLM 只能编。这里覆盖补上的执行端。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const chatMock = vi.fn(async () => '{"query":"AI 大事件","count":5}')
vi.mock('@/lib/ai', () => ({ chat: (...a: never[]) => chatMock(...a) }))

const getSkillById = vi.fn()
vi.mock('@/lib/data/skills', () => ({ getSkillById: (...a: never[]) => getSkillById(...a) }))

const checkSkillRunnable = vi.fn(async () => ({ runnable: true, blockedBy: [] }))
const listSkillPluginDeps = vi.fn(async () => [{ id: 'd1', skillId: 's1', objectType: 'tool', objectId: 'T1', objectVersion: null, required: true }])
vi.mock('@/lib/data/skill-dependencies', () => ({
  checkSkillRunnable: (...a: never[]) => checkSkillRunnable(...a),
  listSkillPluginDeps: (...a: never[]) => listSkillPluginDeps(...a),
}))

const listAgentTools = vi.fn()
const runToolVersion = vi.fn()
vi.mock('@/lib/tools/run', () => ({
  listAgentTools: (...a: never[]) => listAgentTools(...a),
  runToolVersion: (...a: never[]) => runToolVersion(...a),
}))

import { buildToolArgs, pickSkillId, runToolNode } from '@/lib/workflow/tool-node'

const ctx = { userId: 'u1', orgId: 'o1', roles: ['User'] } as never
const tool = { name: 'web_search', description: '联网搜索' }
const runnableTool = {
  toolId: 'T1', versionId: 'V1', name: 'web_search', description: '联网搜索',
  bindingType: 'native', riskLevel: 'low' as const,
  inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
}

beforeEach(() => {
  vi.clearAllMocks()
  getSkillById.mockResolvedValue({ id: 's1', name: '联网搜索', status: 'published' })
  checkSkillRunnable.mockResolvedValue({ runnable: true, blockedBy: [] })
  listSkillPluginDeps.mockResolvedValue([{ id: 'd1', skillId: 's1', objectType: 'tool', objectId: 'T1', objectVersion: null, required: true }])
  listAgentTools.mockResolvedValue([runnableTool])
  runToolVersion.mockResolvedValue({ ok: true, content: '搜到 3 条结果' })
})

describe('pickSkillId', () => {
  it('tool_id 优先，兼容历史的 skill_id', () => {
    expect(pickSkillId({ tool_id: 'a' })).toBe('a')
    expect(pickSkillId({ skill_id: 'b' })).toBe('b')
    expect(pickSkillId({})).toBe('')
  })
})

describe('buildToolArgs', () => {
  it('单个字符串参数 → 直接喂节点输入，不惊动模型', async () => {
    const args = await buildToolArgs(
      { properties: { query: { type: 'string' } } }, '昨天的AI大事件', {}, tool,
    )
    expect(args).toEqual({ query: '昨天的AI大事件' })
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('面板固定填的参数优先，且不再问模型', async () => {
    const args = await buildToolArgs(
      { properties: { query: { type: 'string' } } }, '节点输入', { query: '固定检索词' }, tool,
    )
    expect(args).toEqual({ query: '固定检索词' })
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('无参数的工具 → 空参数', async () => {
    expect(await buildToolArgs({}, 'x', {}, tool)).toEqual({})
  })

  it('多参数 → 让模型按 schema 生成，并丢掉 schema 外的键', async () => {
    chatMock.mockResolvedValueOnce('{"query":"AI","count":5,"__hack":"x"}')
    const args = await buildToolArgs(
      { properties: { query: { type: 'string' }, count: { type: 'number' } } }, 'AI 新闻', {}, tool,
    )
    expect(args).toEqual({ query: 'AI', count: 5 })
    expect(args).not.toHaveProperty('__hack')
  })

  it('模型返回不是 JSON 时退回「首个参数塞输入」，不让流程断掉', async () => {
    chatMock.mockResolvedValueOnce('抱歉我无法……')
    const args = await buildToolArgs(
      { properties: { query: { type: 'string' }, count: { type: 'number' } } }, '兜底输入', {}, tool,
    )
    expect(args.query).toBe('兜底输入')
  })
})

describe('runToolNode 前置校验', () => {
  it('正常路径：调用真实 Tool 并回传结果', async () => {
    const r = await runToolNode(ctx, { tool_id: 's1' }, '昨天的AI大事件')
    expect(r).toMatchObject({ ok: true, output: '搜到 3 条结果', toolName: 'web_search' })
    expect(runToolVersion).toHaveBeenCalledWith(ctx, 'V1', { query: '昨天的AI大事件' })
  })

  it('没绑 Skill → 明确报错', async () => {
    expect(await runToolNode(ctx, {}, 'x')).toMatchObject({ ok: false, error: expect.stringContaining('未绑定 Skill') })
  })

  it('🔴 Skill 未发布 → 拒绝调用（运行期放行等于绕开上架审核）', async () => {
    getSkillById.mockResolvedValue({ id: 's1', name: '联网搜索', status: 'draft' })
    const r = await runToolNode(ctx, { tool_id: 's1' }, 'x')
    expect(r).toMatchObject({ ok: false })
    expect((r as { error: string }).error).toContain('未发布')
  })

  it('依赖的 Tool 已下线 → 说清是谁挡住的', async () => {
    checkSkillRunnable.mockResolvedValue({
      runnable: false,
      blockedBy: [{ objectType: 'tool', objectId: 'T1', name: 'web_search', reason: '依赖的 Tool 已下线' }],
    })
    const r = await runToolNode(ctx, { tool_id: 's1' }, 'x')
    expect((r as { error: string }).error).toContain('已下线')
  })

  it('Skill 没挂任何 Tool → 报错而不是假装跑过', async () => {
    listSkillPluginDeps.mockResolvedValue([])
    const r = await runToolNode(ctx, { tool_id: 's1' }, 'x')
    expect((r as { error: string }).error).toContain('没有绑定任何 Tool')
  })

  it('Tool 调用失败 → 原样上报失败原因', async () => {
    runToolVersion.mockResolvedValue({ ok: false, content: '调用返回 HTTP 401' })
    const r = await runToolNode(ctx, { tool_id: 's1' }, 'x')
    expect(r.ok).toBe(false)
    expect((r as { error: string }).error).toContain('HTTP 401')
  })
})
