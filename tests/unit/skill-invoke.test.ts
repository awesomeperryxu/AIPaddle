/**
 * L2 单元测试 · lib/skills/invoke.ts（ROADMAP 4.3.2）
 * 覆盖 S3-09 白名单 / S3-10 运行期禁用联动 / S3-11 切面互不越界。
 */
import { describe, it, expect } from 'vitest'
import { evaluateSkillCall } from '@/lib/skills/invoke'

describe('evaluateSkillCall（Skill 试跑校验）', () => {
  it('非 MCP 型直接放行', () => {
    expect(evaluateSkillCall({ type: 'API', allowedTools: [] })).toEqual({ ok: true })
    expect(evaluateSkillCall({ type: 'Prompt', allowedTools: [] }).ok).toBe(true)
  })

  it('S3-10：引用的 Server 被禁用 → server_disabled', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read'], requestedTool: 'read', serverStatus: 'disabled' })
    expect(r).toMatchObject({ ok: false, code: 'server_disabled' })
  })

  it('S3-10：Server 未审批（pending）也不可用', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read'], requestedTool: 'read', serverStatus: 'pending' })
    expect(r.ok).toBe(false)
  })

  it('MCP 型未指定工具 → tool_required', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read'], serverStatus: 'approved' })
    expect(r).toMatchObject({ ok: false, code: 'tool_required' })
  })

  it('S3-09：调用白名单外工具 → tool_not_allowed', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read'], requestedTool: 'delete', serverStatus: 'approved' })
    expect(r).toMatchObject({ ok: false, code: 'tool_not_allowed' })
  })

  it('S3-09：调用白名单内工具 → 放行', () => {
    const r = evaluateSkillCall({ type: 'MCP', allowedTools: ['read', 'list'], requestedTool: 'read', serverStatus: 'approved' })
    expect(r).toEqual({ ok: true })
  })

  it('S3-11：同 Server 两切面白名单互不越界', () => {
    // 「查询」切面只授权 read/list；试图调管理工具 manage → 被拒
    const readonly = evaluateSkillCall({ type: 'MCP', allowedTools: ['read', 'list'], requestedTool: 'manage', serverStatus: 'approved' })
    expect(readonly).toMatchObject({ ok: false, code: 'tool_not_allowed' })
    // 「管理」切面授权 manage → 放行
    const admin = evaluateSkillCall({ type: 'MCP', allowedTools: ['manage'], requestedTool: 'manage', serverStatus: 'approved' })
    expect(admin.ok).toBe(true)
  })
})
