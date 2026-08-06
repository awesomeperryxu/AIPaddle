import { getRequestContext } from '@/lib/context'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { listTeams } from '@/lib/data/digital-employee-teams'
import { createClient } from '@/lib/supabase/server'

// GET /api/digital-employees —— @@ 唤醒候选列表（4.1.20 / ADR-014）。
// 返回本租户「数字员工」与「数字员工团队」的 {id,name,openingStatement,suggestedQuestions}。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }

  const supabase = await createClient()
  const [deIds, teams, { data: agents }] = await Promise.all([
    listDigitalEmployeeIds(ctx),
    listTeams(ctx),
    supabase.from('agents').select('id,name,config').is('deleted_at', null),
  ])
  const deSet = new Set(deIds)
  const agentList = (agents ?? []).filter((a) => deSet.has(a.id as string))
  const employees = agentList.map((a) => {
    const cfg = (a.config ?? {}) as { openingStatement?: string; suggestedQuestions?: string[] }
    return {
      id: a.id as string,
      name: a.name as string,
      openingStatement: cfg.openingStatement || '',
      suggestedQuestions: (cfg.suggestedQuestions ?? []).filter(Boolean),
    }
  })
  const teamList = teams.map((t) => ({ id: t.id, name: t.name }))

  return Response.json({ employees, teams: teamList })
}
