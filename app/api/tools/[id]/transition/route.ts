import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionTool } from '@/lib/data/tools'
import { TOOL_TRANSITIONS, type PluginTransitionAction } from '@/lib/plugins/status'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as PluginTransitionAction
  const t = TOOL_TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }

  const { id } = await params
  const r = await transitionTool(ctx, id, action)
  if (!r.ok) {
    if (r.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  // Tool 下线要阻断依赖它的资产的新运行（AC-17），流转必须留痕
  await writeAudit(ctx, `tool.${action}`, 'tool', id, { to: r.status })
  return Response.json({ status: r.status })
}
