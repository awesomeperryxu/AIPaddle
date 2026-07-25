import { getRequestContext } from '@/lib/context'
import { listConversations, createConversation, listMessages } from '@/lib/data/conversations'

// GET /api/assistant/conversations?withMessages=true
// withMessages=true 时附带第一条会话的消息，减少前端瀑布请求
export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const withMessages = searchParams.get('withMessages') === 'true'
  const conversations = await listConversations(ctx)
  if (withMessages && conversations.length > 0) {
    const messages = await listMessages(ctx, conversations[0].id)
    return Response.json({ conversations, firstMessages: messages, firstConversationId: conversations[0].id })
  }
  return Response.json({ conversations })
}

// POST /api/assistant/conversations —— 新建会话
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const title = typeof body?.title === 'string' ? body.title : undefined
  const conversation = await createConversation(ctx, title)
  return Response.json({ conversation }, { status: 201 })
}
