import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getTeam, updateTeam, deleteTeam } from '@/lib/data/digital-employee-teams'
import { listAgents } from '@/lib/data/agents'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

// GET /api/teams/[id] —— 取单个团队（含 memberIds）。RLS 兜底：他租户/不存在 → 404。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const team = await getTeam(ctx, id)
  if (!team) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ team })
}

// PATCH /api/teams/[id] —— 更新团队（名称/描述/成员）。权限 agent:update。
// 成员门控（服务端，不信前端）：memberIds 接受「本租户」的 agent——**数字员工与普通
// Agent 并级**（DE-10 / D-12 放宽，见 ADR-026）；越权者剔除并回带 rejected。
// 团队不套团队由数据模型保证（成员指向 agents 表，团队在 digital_employee_teams）。
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:update')) return Response.json({ error: { code: 'forbidden', message: '无权限：修改团队' } }, { status: 403 })
  const { id } = await params
  if (!(await getTeam(ctx, id))) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = typeof body?.name === 'string' ? body.name : undefined
  const description = typeof body?.description === 'string' ? body.description : undefined

  // 成员门控：仅当携带 memberIds 才处理。授权集=本租户 Agent（RLS 隔离）。
  //
  // 🔴 DE-10（2026-08-07，D-12 放宽 / ADR-026 §1）：成员**可以是数字员工，
  // 也可以是普通 Agent，两者在团队 Workflow 中并级**。原规则「成员必须是数字员工」
  // 要求任何 Agent 进团队前先包一层数字员工——而这层壳只挂一个 Agent 时不携带
  // 任何信息，纯属仪式。
  //
  // 放宽后**铁律仍完整**：R1 Agent 下不可挂 Agent、R2 Agent 的上级不可以是 Agent
  // （团队不是 Agent，所以 `团队 → 普通 Agent` 合法，只是跳过了中间那层）。
  // 唯一要拦的是 **团队不得嵌套团队**——但 memberIds 指向的是 agents 表，
  // 团队在 digital_employee_teams，天然进不来，这条由数据模型保证。
  let memberIds: string[] | undefined
  const rejected: { id: string; reason: string }[] = []
  if (Array.isArray(body?.memberIds)) {
    const rawIds = (body.memberIds as unknown[]).map(String)
    const agents = await listAgents(ctx)
    const byId = new Map(agents.map((a) => [a.id, a]))
    const accepted: string[] = []
    const seen = new Set<string>()
    for (const cid of rawIds) {
      if (seen.has(cid)) continue
      seen.add(cid)
      const agent = byId.get(cid)
      if (!agent) {
        rejected.push({ id: cid, reason: `「${cid}」不是本租户 Agent 或你无权使用，不能加入团队` })
        continue
      }
      accepted.push(cid)
    }
    memberIds = accepted
  }

  const team = await updateTeam(ctx, id, { name, description, memberIds })
  if (!team) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ team, rejected })
}

// DELETE /api/teams/[id] —— 软删团队。权限 agent:delete。跨租户/不存在 → 404。
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:delete')) return Response.json({ error: { code: 'forbidden', message: '无权限：删除团队' } }, { status: 403 })
  const { id } = await params
  const ok = await deleteTeam(ctx, id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ ok: true })
}
