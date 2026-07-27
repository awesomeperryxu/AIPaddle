import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { answerQuestion } from '@/lib/kb/rag'

// POST /api/knowledge/ask —— 知识库 RAG 问答（4.2.3）。
// body: { question, kbId?, topK?(1-20 整数), scoreThreshold?(0-1) }。非法的检索参数被忽略（回落库配置/默认）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const question = String(body?.question ?? '').trim()
  if (!question) return Response.json({ error: { code: 'invalid', message: '问题不能为空' } }, { status: 400 })

  const kbId = typeof body?.kbId === 'string' && body.kbId.trim() ? body.kbId.trim() : undefined
  // topK：正整数且 1-20，否则忽略
  const rawK = Number(body?.topK)
  const topK = Number.isInteger(rawK) && rawK >= 1 && rawK <= 20 ? rawK : undefined
  // scoreThreshold：0-1 数字，否则忽略
  const rawTh = Number(body?.scoreThreshold)
  const scoreThreshold = Number.isFinite(rawTh) && rawTh >= 0 && rawTh <= 1 ? rawTh : undefined

  const result = await answerQuestion(ctx, question, { kbId, topK, scoreThreshold })
  return Response.json(result)
}
