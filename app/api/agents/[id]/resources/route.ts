import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById } from '@/lib/data/agents'
import { getAgentResources, setAgentResources } from '@/lib/data/agent-resources'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/agents/[id]/resources —— 读取 Agent 直挂的知识库/Skill（4.1.11）。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getAgentById(ctx, id))) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ resources: await getAgentResources(ctx, id) })
}

// PUT /api/agents/[id]/resources —— 覆盖设置直挂知识库/Skill。权限 agent:update。
export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:update')) return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Agent' } }, { status: 403 })
  const { id } = await params
  if (!(await getAgentById(ctx, id))) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const knowledgeBaseIds = Array.isArray(body?.knowledgeBaseIds) ? body.knowledgeBaseIds.map(String) : []
  const skillIds = Array.isArray(body?.skillIds) ? body.skillIds.map(String) : []
  const resources = await setAgentResources(ctx, id, { knowledgeBaseIds, skillIds })
  return Response.json({ resources })
}
