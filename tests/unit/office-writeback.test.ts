/**
 * L2 单元测试 · 通道② 云盘写回权限切面（ROADMAP 4.3.4 · 验收 DOC-04/DOC-05）
 * 写回复用 evaluateSkillCall 的运行期白名单校验，此处以写工具场景断言切面隔离。
 */
import { describe, it, expect } from 'vitest'
import { evaluateSkillCall } from '@/lib/skills/invoke'

const WRITE = 'write'

describe('云盘写回权限切面（DOC-04）', () => {
  it('「微盘写入」Skill（allowed_tools 含 write）→ 允许写回', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read', 'write'], requestedTool: WRITE, serverStatus: 'approved' })
    expect(r).toEqual({ ok: true })
  })

  it('只读 Skill（allowed_tools 仅 read）→ 写回被拒（tool_not_allowed）', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read'], requestedTool: WRITE, serverStatus: 'approved' })
    expect(r).toMatchObject({ ok: false, code: 'tool_not_allowed' })
  })

  it('DOC-05：云盘 Server 未审批/被禁用 → 任何写回不可用', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['write'], requestedTool: WRITE, serverStatus: 'disabled' })
    expect(r).toMatchObject({ ok: false, code: 'server_disabled' })
  })
})
