import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listKnowledgeBases, createKnowledgeBase } from '@/lib/data/knowledge'

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const knowledgeBases = await listKnowledgeBases(ctx)
  return Response.json({ knowledgeBases })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建知识库' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  const kb = await createKnowledgeBase(ctx, {
    name,
    description: typeof body?.description === 'string' ? body.description : undefined,
  })
  return Response.json({ knowledgeBase: kb }, { status: 201 })
}
