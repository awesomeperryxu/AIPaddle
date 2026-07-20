import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { answerQuestion } from '@/lib/kb/rag'

// POST /api/knowledge/ask —— 知识库 RAG 问答（4.2.3）。body: { question }
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const question = String(body?.question ?? '').trim()
  if (!question) return Response.json({ error: { code: 'invalid', message: '问题不能为空' } }, { status: 400 })

  const result = await answerQuestion(ctx, question)
  return Response.json(result)
}
