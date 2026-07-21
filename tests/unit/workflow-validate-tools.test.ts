import { describe, it, expect, vi } from 'vitest'

const getSkillByIdMock = vi.fn()
vi.mock('@/lib/data/skills', () => ({ getSkillById: (...a: unknown[]) => getSkillByIdMock(...a) }))

import { validateToolNodes } from '@/lib/workflow/validate-tools'

const ctx = { userId: 'u', orgId: 'o', roles: ['Admin' as const] }
const toolNode = (id: string, config: Record<string, unknown>) => ({ id, type: 'tool', data: { config } })
const graph = (nodes: unknown[]) => ({ nodes: nodes as never[], edges: [] })

describe('validateToolNodes（4.4.2 Tool 只引用已发布 Skill）', () => {
  it('无 Tool 节点 → 无错误（不查库）', async () => {
    getSkillByIdMock.mockReset()
    const e = await validateToolNodes(ctx, graph([{ id: 's', type: 'start' }, { id: 't', type: 'end' }]))
    expect(e).toEqual([])
    expect(getSkillByIdMock).not.toHaveBeenCalled()
  })

  it('引用已发布 Skill → 通过', async () => {
    getSkillByIdMock.mockReset().mockResolvedValue({ id: 'sk1', name: '邮件Skill', status: 'published' })
    const e = await validateToolNodes(ctx, graph([toolNode('tn', { tool_id: 'sk1' })]))
    expect(e).toEqual([])
  })

  it('引用未发布 Skill → tool_skill_unpublished', async () => {
    getSkillByIdMock.mockReset().mockResolvedValue({ id: 'sk1', name: '草稿Skill', status: 'draft' })
    const e = await validateToolNodes(ctx, graph([toolNode('tn', { tool_id: 'sk1' })]))
    expect(e[0].code).toBe('tool_skill_unpublished')
  })

  it('引用不存在 Skill → tool_skill_missing', async () => {
    getSkillByIdMock.mockReset().mockResolvedValue(null)
    const e = await validateToolNodes(ctx, graph([toolNode('tn', { tool_id: 'ghost' })]))
    expect(e[0].code).toBe('tool_skill_missing')
  })

  it('未选择 Skill → tool_no_skill', async () => {
    getSkillByIdMock.mockReset()
    const e = await validateToolNodes(ctx, graph([toolNode('tn', {})]))
    expect(e[0].code).toBe('tool_no_skill')
  })

  it('直连 MCP（mcp_server_id）→ mcp_direct，且不查库', async () => {
    getSkillByIdMock.mockReset()
    const e = await validateToolNodes(ctx, graph([toolNode('tn', { mcp_server_id: 'srv-1', tool_id: 'sk1' })]))
    expect(e[0].code).toBe('mcp_direct')
    expect(getSkillByIdMock).not.toHaveBeenCalled()
  })
})
