import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionExtension } from '@/lib/data/extensions'
import { EXT_TRANSITIONS, type ExtTransitionAction } from '@/lib/extensions/status'
import { writeAudit } from '@/lib/data/audit'

// V12-8.10：Extension 状态流转。动作驱动（body 传 action），非法流转回 409。
// 与 Agent 的 transition 端点保持同一语义，避免两套写法。
type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as ExtTransitionAction
  const t = EXT_TRANSITIONS[action]
  if (!t) return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  if (!can(ctx, t.action)) {
    return Response.json({ error: { code: 'forbidden', message: `无权限：${action}` } }, { status: 403 })
  }

  const { id } = await params
  const result = await transitionExtension(ctx, id, action)
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    // 409：请求本身合法，是与当前状态冲突
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  // 发布/下线直接改变对外可访问性，必须留痕
  await writeAudit(ctx, `extension.${action}`, 'extension', id, { to: result.status })
  return Response.json({ status: result.status })
}
