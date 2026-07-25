import { getRequestContext } from '@/lib/context'
import {
  getOwnedConversation, listMessages, appendMessage, renameConversation,
} from '@/lib/data/conversations'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/assistant/conversations/[id]/wake-messages
// @@ 唤醒消息落库：用户消息（speaker_type=user）+ 数字员工回复（speaker_type=agent+speaker_id）。
// 依赖 migration 0014 的 speaker_type/speaker_id/speak_reason 列。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getOwnedConversation(ctx, id)))
    return Response.json({ error: { code: 'not_found', message: '会话不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const userContent = String(body?.userContent ?? '').trim()
  const replies = Array.isArray(body?.replies)
    ? (body.replies as Array<{ agentId: string; content: string }>)
    : []

  if (!userContent)
    return Response.json({ error: { code: 'invalid', message: '消息内容不能为空' } }, { status: 400 })

  // 首条消息则自动命名会话
  const prior = await listMessages(ctx, id)

  await appendMessage(ctx, id, {
    role: 'user',
    content: userContent,
    speakerType: 'user',
    speakReason: 'mention',
  })

  if (prior.length === 0) {
    await renameConversation(ctx, id, userContent.slice(0, 24))
  }

  for (const reply of replies) {
    if (typeof reply.agentId !== 'string' || !reply.agentId) continue
    await appendMessage(ctx, id, {
      role: 'assistant',
      content: String(reply.content ?? ''),
      speakerType: 'agent',
      speakerId: reply.agentId,
    })
  }

  return Response.json({ ok: true })
}
