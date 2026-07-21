import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 监控看板真实指标（BUG-74）。只覆盖有真实数据源的字段，其余（成本/活跃用户/风控）由前端保留 mock 并标占位。
export type DashboardStatsReal = {
  totalAgents: number
  publishedAgents: number
  pendingReviews: number
  todayCalls: number
  todayTokens: number
  successRate: number
  totalSkills: number
  publishedSkills: number
}

export async function getDashboardStats(_ctx: RequestContext): Promise<DashboardStatsReal> {
  const supabase = await createClient()

  // Agent 计数
  const { data: agents } = await supabase.from('agents').select('status').is('deleted_at', null)
  const agentRows = (agents ?? []) as { status: string }[]
  const totalAgents = agentRows.length
  const publishedAgents = agentRows.filter(a => a.status === 'published').length

  // 待审核项（security_reviews）
  const { count: pendingCount } = await supabase
    .from('security_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('deleted_at', null)

  // 调用日志聚合（数据量有限，JS 内聚合）
  const { data: logs } = await supabase
    .from('call_logs')
    .select('tokens_in,tokens_out,success,created_at')
    .is('deleted_at', null)
  const logRows = (logs ?? []) as { tokens_in: number; tokens_out: number; success: boolean; created_at: string | null }[]
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()
  const todayLogs = logRows.filter(l => (l.created_at ?? '') >= todayIso)
  const todayCalls = todayLogs.length
  const todayTokens = todayLogs.reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
  const successRate =
    logRows.length > 0 ? Math.round((logRows.filter(l => l.success).length / logRows.length) * 1000) / 10 : 100

  // Skill 计数（C 道表，只读；表/列缺失时容错为 0）
  let totalSkills = 0
  let publishedSkills = 0
  try {
    const { data: skills } = await supabase.from('skills').select('status').is('deleted_at', null)
    const skillRows = (skills ?? []) as { status: string }[]
    totalSkills = skillRows.length
    publishedSkills = skillRows.filter(s => s.status === 'published').length
  } catch {
    // skills 表尚未就绪 → 保持 0
  }

  return {
    totalAgents,
    publishedAgents,
    pendingReviews: pendingCount ?? 0,
    todayCalls,
    todayTokens,
    successRate,
    totalSkills,
    publishedSkills,
  }
}
