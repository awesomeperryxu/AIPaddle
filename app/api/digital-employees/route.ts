import { getRequestContext } from '@/lib/context'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { listTeams } from '@/lib/data/digital-employee-teams'

// GET /api/digital-employees —— @@ 唤醒候选列表（4.1.20 / ADR-014）。
// 返回本租户「数字员工」与「数字员工团队」的 {id,name}，供聊天窗 @@ 选择器拉取。
// 读取语义对齐 GET /api/agents / GET /api/teams（ADR-007 agent:read 行=全角色✅，
// 读端点无独立 enforced action）：登录即可读，RLS 隔离本租户（= 有权访问）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }

  // 数字员工 = 引用了 ≥1 子 Agent 的 Agent（ADR-014）。取 id 集合后与本租户 Agent 名称对齐。
  const [agents, deIds, teams] = await Promise.all([
    listAgents(ctx),
    listDigitalEmployeeIds(ctx),
    listTeams(ctx),
  ])
  const deSet = new Set(deIds)
  const employees = agents
    .filter((a) => deSet.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }))
  const teamList = teams.map((t) => ({ id: t.id, name: t.name }))

  return Response.json({ employees, teams: teamList })
}
