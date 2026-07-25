import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listTeams, createTeam } from '@/lib/data/digital-employee-teams'

// GET /api/teams —— 列出本租户数字员工团队（4.1.19 / ADR-014）。
// 读取语义对齐 GET /api/agents：登录即可读（RLS 隔离本租户），不额外新增 action。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const teams = await listTeams(ctx)
  return Response.json({ teams })
}

// POST /api/teams —— 创建数字员工团队（草稿态，无成员）。权限 agent:create（复用，不新增 action）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:create')) return Response.json({ error: { code: 'forbidden', message: '无权限：创建团队' } }, { status: 403 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })

  const team = await createTeam(ctx, { name })
  return Response.json({ team }, { status: 201 })
}
