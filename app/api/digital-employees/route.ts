import { getRequestContext } from '@/lib/context'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { listTeams } from '@/lib/data/digital-employee-teams'

// GET /api/digital-employees —— @@ 唤醒候选列表（4.1.20 / ADR-014）。
// 返回本租户「数字员工」与「数字员工团队」的 {id,name,openingStatement,suggestedQuestions}。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }

  const [agents, deIds, teams] = await Promise.all([
    listAgents(ctx),
    listDigitalEmployeeIds(ctx),
    listTeams(ctx),
  ])
  const deSet = new Set(deIds)
  const employees = agents
    .filter((a) => deSet.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      openingStatement: a.openingStatement ?? '',
      suggestedQuestions: a.suggestedQuestions ?? [],
    }))
  const teamList = teams.map((t) => ({ id: t.id, name: t.name }))

  return Response.json({ employees, teams: teamList })
}
