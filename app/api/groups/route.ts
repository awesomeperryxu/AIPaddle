import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listGroups, createGroup, type GroupParticipant } from '@/lib/data/group-chat'
import { listAgents } from '@/lib/data/agents'
import { listTeams } from '@/lib/data/digital-employee-teams'
import { getAgentResources } from '@/lib/data/agent-resources'
import { isDigitalEmployee } from '@/lib/agents/digital-employee'

// GET /api/groups —— 列出本租户群聊（4.1.21 / ADR-015）。登录即可读，RLS 隔离本租户。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const groups = await listGroups(ctx)
  return Response.json({ groups })
}

// POST /api/groups —— 创建群聊。权限 agent:chat（复用，不新增 enforced action）。
// 参与者门控（服务端，不信前端）：agent 只纳入本租户数字员工；team 只纳入本租户团队；
// user 仅接受本人；越权/非数字员工剔除并回带 rejected。创建者自动作为 user 参与者。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:chat')) return Response.json({ error: { code: 'forbidden', message: '无权限：创建群聊' } }, { status: 403 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '群名不能为空' } }, { status: 400 })

  const raw: { type: string; id: string }[] = Array.isArray(body?.participants)
    ? (body.participants as unknown[])
        .filter((p): p is { type: string; id: string } => !!p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string')
        .map((p) => ({ type: String((p as { type?: unknown }).type ?? ''), id: (p as { id: string }).id }))
    : []

  const [agents, teams] = await Promise.all([listAgents(ctx), listTeams(ctx)])
  const agentById = new Map(agents.map((a) => [a.id, a]))
  const teamSet = new Set(teams.map((t) => t.id))

  const accepted: GroupParticipant[] = [{ type: 'user', id: ctx.userId }] // 创建者必入群
  const rejected: { id: string; type: string; reason: string }[] = []
  const seen = new Set<string>(`user:${ctx.userId}`)

  for (const p of raw) {
    const key = `${p.type}:${p.id}`
    if (seen.has(key)) continue
    seen.add(key)
    if (p.type === 'user') {
      if (p.id === ctx.userId) continue // 已加入
      rejected.push({ id: p.id, type: p.type, reason: '仅可将本人加入群聊' })
    } else if (p.type === 'agent') {
      const agent = agentById.get(p.id)
      if (!agent) {
        rejected.push({ id: p.id, type: p.type, reason: '不是本租户 Agent 或你无权使用' })
        continue
      }
      const res = await getAgentResources(ctx, p.id)
      if (!isDigitalEmployee(res.subAgentIds)) {
        rejected.push({ id: p.id, type: p.type, reason: `「${agent.name}」不是数字员工，不能加入群聊` })
        continue
      }
      accepted.push({ type: 'agent', id: p.id })
    } else if (p.type === 'team') {
      if (!teamSet.has(p.id)) {
        rejected.push({ id: p.id, type: p.type, reason: '不是本租户数字员工团队' })
        continue
      }
      accepted.push({ type: 'team', id: p.id })
    } else {
      rejected.push({ id: p.id, type: p.type, reason: '未知参与者类型' })
    }
  }

  const group = await createGroup(ctx, { name, participants: accepted })
  return Response.json({ group, rejected }, { status: 201 })
}
