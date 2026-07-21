import { getRequestContext } from '@/lib/context'
import { getOwnedConversation, renameConversation, deleteConversation } from '@/lib/data/conversations'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/assistant/conversations/[id] —— 重命名会话
export async function PATCH(request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getOwnedConversation(ctx, id)))
    return Response.json({ error: { code: 'not_found', message: '会话不存在或无权访问' } }, { status: 404 })
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const title = String(body?.title ?? '').trim()
  if (!title) return Response.json({ error: { code: 'invalid', message: '标题不能为空' } }, { status: 400 })
  await renameConversation(ctx, id, title)
  return Response.json({ ok: true })
}

// DELETE /api/assistant/conversations/[id] —— 删除会话（软删）
export async function DELETE(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getOwnedConversation(ctx, id)))
    return Response.json({ error: { code: 'not_found', message: '会话不存在或无权访问' } }, { status: 404 })
  await deleteConversation(ctx, id)
  return Response.json({ ok: true })
}
