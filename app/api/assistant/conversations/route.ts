import { getRequestContext } from '@/lib/context'
import { listConversations, createConversation } from '@/lib/data/conversations'

// GET /api/assistant/conversations —— 本人个人助理会话列表
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const conversations = await listConversations(ctx)
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
