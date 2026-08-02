import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionPlugin } from '@/lib/data/plugins'
import { PLUGIN_TRANSITIONS, type PluginTransitionAction } from '@/lib/plugins/status'
import { writeAudit } from '@/lib/data/audit'

// V12-2.8：Plugin 状态流转。动作驱动（body 传 action），非法流转回 409。
type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as PluginTransitionAction
  const t = PLUGIN_TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }

  const { id } = await params
  const r = await transitionPlugin(ctx, id, action)
  if (!r.ok) {
    if (r.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  // 发布/下线改变「能否被上层资产依赖」，必须留痕
  await writeAudit(ctx, `plugin.${action}`, 'plugin', id, { to: r.status })
  return Response.json({ status: r.status })
}
