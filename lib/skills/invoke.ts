import type { SkillType } from '@/lib/skills/status'
import type { McpStatus } from '@/lib/mcp/status'

// Skill 试跑前的权限/白名单校验（4.3.2）。纯函数，供 API 与单元测试共用。
// 覆盖：S3-09 运行期白名单（MCP 型只能调 allowed_tools 内工具）、
//       S3-10 运行期禁用联动（引用的 Server 非 approved → 不可用）。

export type SkillCallCheckInput = {
  type: SkillType
  allowedTools: string[]
  requestedTool?: string
  /** MCP 型必填：所引用 Server 的当前状态；非 approved 即不可用 */
  serverStatus?: McpStatus
}

export type SkillCallCheck =
  | { ok: true }
  | { ok: false; code: 'server_disabled' | 'tool_required' | 'tool_not_allowed'; message: string }

export function evaluateSkillCall(input: SkillCallCheckInput): SkillCallCheck {
  // 非 MCP 型：本版无工具白名单，直接放行试跑
  if (input.type !== 'MCP') return { ok: true }

  // S3-10 运行期：引用的 MCP Server 被禁用/未审批 → 引用它的 Skill 立即不可用
  if (input.serverStatus !== 'approved') {
    return { ok: false, code: 'server_disabled', message: '所引用的 MCP Server 未审批或已禁用，Skill 不可用' }
  }
  // 必须指定要调用的工具
  const tool = (input.requestedTool ?? '').trim()
  if (!tool) return { ok: false, code: 'tool_required', message: '请指定要调用的工具（tool）' }
  // S3-09：只能调用封装白名单 allowed_tools 内的工具（S3-11：不同切面各自的白名单互不越界）
  if (!input.allowedTools.includes(tool)) {
    return { ok: false, code: 'tool_not_allowed', message: `工具「${tool}」不在该 Skill 的授权白名单内` }
  }
  return { ok: true }
}
