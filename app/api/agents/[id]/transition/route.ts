import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { transitionAgent } from '@/lib/data/agents'
import { TRANSITIONS, type TransitionAction } from '@/lib/agents/status'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

// POST /api/agents/[id]/transition  body: { action }
// 状态机流转（4.1.2）：按动作查所需权限；非法流转（当前态 ≠ from）→ 409。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body?.action as TransitionAction
  const t = TRANSITIONS[action]
  if (!t) {
    return Response.json({ error: { code: 'bad_request', message: '未知流转动作' } }, { status: 400 })
  }
  if (!can(ctx, t.action)) {
    return Response.json(
      { error: { code: 'forbidden', message: `无权限：${action}` } },
      { status: 403 },
    )
  }
  const { id } = await params
  const result = await transitionAgent(ctx, id, action)
  if (!result.ok) {
    if (result.reason === 'not_found') {
      return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    }
    return Response.json(
      { error: { code: 'illegal_transition', message: `非法流转：当前状态无法「${action}」` } },
      { status: 409 },
    )
  }
  return Response.json({ agent: result.agent })
}
