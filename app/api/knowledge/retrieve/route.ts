import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { retrieveSegments } from '@/lib/kb/rag'

// POST /api/knowledge/retrieve —— 检索测试（4.2.5）：只返回召回分段+评分，不生成回答。
// body: { question, kbId? }
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const question = String(body?.question ?? '').trim()
  if (!question) return Response.json({ error: { code: 'invalid', message: '查询不能为空' } }, { status: 400 })
  const kbId = typeof body?.kbId === 'string' ? body.kbId : undefined
  // 4.2.10 命中测试调参：可覆盖 topK/阈值（不传则用 KB 配置）
  const topK = Number.isFinite(Number(body?.topK)) ? Math.min(Math.max(Math.floor(Number(body.topK)), 1), 20) : undefined
  const scoreThreshold = Number.isFinite(Number(body?.scoreThreshold))
    ? Math.min(Math.max(Number(body.scoreThreshold), 0), 1)
    : undefined

  const segments = await retrieveSegments(ctx, question, { kbId, topK, scoreThreshold })
  return Response.json({ segments })
}
