import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'

// POST /api/workflows/copilot —— Workflow Copilot（4.4.5，ADR-005）。
// 描述 → 生成工作流图（draft）+ 校验结果。AI 只产 draft、不保存不发布；
// 用户采纳后经既有 PATCH /api/workflows/[id] 落库。权限：workflow:create。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const description = String(body?.description ?? '').trim()
  if (!description) {
    return Response.json({ error: { code: 'invalid', message: '请描述你想要的工作流' } }, { status: 400 })
  }
  const result = await generateWorkflowGraph(description)
  // 只返回生成的 draft 图 + 校验结果，不落库（用户采纳后自行保存）
  return Response.json({ graph: result.graph, validation: result.validation, valid: result.valid })
}
