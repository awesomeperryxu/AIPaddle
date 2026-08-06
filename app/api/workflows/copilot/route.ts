import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'
import { listSkills } from '@/lib/data/skills'

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
  // ⑤ 增量修改：前端传入当前画布图，Copilot 在此基础上修改
  const existingGraph = body?.existingGraph && typeof body.existingGraph === 'object'
    ? body.existingGraph as { nodes: unknown[]; edges: unknown[] }
    : undefined
  // WF-3：把本租户【已发布】的 Skill 作为可选能力清单交给 Copilot。
  // 🔴 这一项曾在合并中丢失过——不传的话它只能生成 llm 节点假装联网检索，
  // 看着完整、跑起来是编的。create 端点一直有传，此端点必须对齐。
  const availableSkills = (await listSkills(ctx))
    .filter((s) => s.status === 'published')
    .map((s) => ({ id: s.id, name: s.name, description: s.description, type: s.type }))
  const result = await generateWorkflowGraph(description, { existingGraph: existingGraph as never, availableSkills })
  return Response.json({
    graph: result.graph, validation: result.validation, valid: result.valid,
    clarifications: result.clarifications,
  })
}
