import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionMcpServer } from '@/lib/data/mcp-servers'
import { writeAudit } from '@/lib/data/audit'
import { TRANSITIONS, type McpTransitionAction } from '@/lib/mcp/status'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/mcp-servers/[id]/transition  body: { action }
// 审批/启停状态机（4.3.0）：按动作查所需权限；非法流转（当前态 ≠ from）→ 409。
// disable/enable 为治理动作（mcp:review = Admin/Auditor）。禁用后 Skill 联动不可用在 4.3.1 强制。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as McpTransitionAction
  const t = TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }

  const { id } = await params
  const result = await transitionMcpServer(ctx, id, action)
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }

  await writeAudit(ctx, `mcp.${action}`, 'mcp_server', id, { to: t.to })
  return Response.json({ server: result.server })
}
