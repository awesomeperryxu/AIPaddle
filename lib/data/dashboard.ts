import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 监控看板真实指标（BUG-74）。全部字段均由 call_logs / security_reviews / agents / skills / users 真实聚合。
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

// ============ BUG-74：监控看板完整数据对象（全部去 mock） ============

// 通义千问-Plus 计价（元 / 1K token），用于成本估算。
// ⚠️ 估算值：DB 未记录真实计费金额，仅按 token 数 × 固定单价推算，实际以账单为准。
export const QWEN_PLUS_PRICE = { in: 0.0008, out: 0.002 }

/**
 * 成本估算（纯函数，可单测）。返回元；DB 无真实账单，仅按固定单价估算。
 */
export function estimateCost(tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1000) * QWEN_PLUS_PRICE.in + (tokensOut / 1000) * QWEN_PLUS_PRICE.out
}

export type TrendPoint = {
  date: string // MM/DD
  calls: number
  tokens: number
  cost: number
  activeUsers: number
  successRate: number
}

export type ModelShare = { model: string; pct: number; cost: number }
export type DeptShare = { dept: string; pct: number }
export type AgentDist = { name: string; value: number } // value = 调用量占比 %
export type TopAgent = { name: string; calls: number; successRate: number }
export type TopSkill = { name: string; calls: number; type: string; installs: number }
export type RiskRecord = { time: string; riskLevel: string; resourceName: string; status: string }

export type DashboardData = {
  // KPI
  totalAgents: number
  publishedAgents: number
  pendingReviews: number
  todayCalls: number
  todayTokens: number
  successRate: number
  totalSkills: number
  publishedSkills: number
  activeUsers: number
  todayCost: number
  riskBlocked: number
  // 图表 / 明细
  trend: TrendPoint[]
  modelShare: ModelShare[]
  deptShare: DeptShare[]
  agentDistribution: AgentDist[]
  topAgents: TopAgent[]
  topSkills: TopSkill[]
  riskRecords: RiskRecord[]
}

// 调用日志行（bucketByDay 用到的最小子集）
export type CallLogLike = {
  created_at: string | null
  tokens_in: number | null
  tokens_out: number | null
  success: boolean | null
  user_id: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * 按自然日分桶（纯函数，可单测）。取 now 往前 days 天（含今日），
 * 用 UTC 日期键分组，避免时区不确定性。空白日成功率按约定回落 100（与总成功率默认一致）。
 */
export function bucketByDay(logs: CallLogLike[], days: number, now: Date = new Date()): TrendPoint[] {
  const byKey = new Map<string, CallLogLike[]>()
  for (const l of logs) {
    const key = (l.created_at ?? '').slice(0, 10) // YYYY-MM-DD (UTC)
    if (!key) continue
    const arr = byKey.get(key)
    if (arr) arr.push(l)
    else byKey.set(key, [l])
  }

  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    const label = key.slice(5).replace('-', '/') // MM/DD
    const dayLogs = byKey.get(key) ?? []
    const calls = dayLogs.length
    const tokens = dayLogs.reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
    const cost = dayLogs.reduce((s, l) => s + estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0), 0)
    const activeUsers = new Set(dayLogs.map(l => l.user_id).filter(Boolean)).size
    const successRate = calls > 0 ? round1((dayLogs.filter(l => l.success).length / calls) * 100) : 100
    out.push({ date: label, calls, tokens, cost: round2(cost), activeUsers, successRate })
  }
  return out
}

type FullCallLog = CallLogLike & { agent_id: string | null; model: string | null }

export async function getDashboardData(_ctx: RequestContext): Promise<DashboardData> {
  const supabase = await createClient()

  // 并行拉取（数据量小，JS 内聚合）——RLS 已按 org_id 隔离
  const [agentsRes, skillsRes, usersRes, logsRes, pendingRes, rejectedRes] = await Promise.all([
    supabase.from('agents').select('id,name,status').is('deleted_at', null),
    supabase.from('skills').select('id,name,status,installs,type').is('deleted_at', null),
    supabase.from('users').select('id,department'),
    supabase
      .from('call_logs')
      .select('agent_id,user_id,model,tokens_in,tokens_out,success,created_at')
      .is('deleted_at', null),
    supabase
      .from('security_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('deleted_at', null),
    supabase
      .from('security_reviews')
      .select('type,resource_id,risk_level,created_at')
      .eq('status', 'rejected')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const agentRows = (agentsRes.data ?? []) as { id: string; name: string; status: string }[]
  const skillRows = (skillsRes.data ?? []) as { id: string; name: string; status: string; installs: number | null; type: string | null }[]
  const userRows = (usersRes.data ?? []) as { id: string; department: string | null }[]
  const logRows = (logsRes.data ?? []) as FullCallLog[]
  const rejectedRows = (rejectedRes.data ?? []) as { type: string | null; resource_id: string | null; risk_level: string | null; created_at: string | null }[]

  const agentName = new Map(agentRows.map(a => [a.id, a.name]))
  const skillName = new Map(skillRows.map(s => [s.id, s.name]))
  const userDept = new Map(userRows.map(u => [u.id, u.department]))

  // KPI
  const totalAgents = agentRows.length
  const publishedAgents = agentRows.filter(a => a.status === 'published').length
  const totalSkills = skillRows.length
  const publishedSkills = skillRows.filter(s => s.status === 'published').length

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()
  const todayLogs = logRows.filter(l => (l.created_at ?? '') >= todayIso)
  const todayCalls = todayLogs.length
  const todayTokens = todayLogs.reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)
  const todayCost = round2(todayLogs.reduce((s, l) => s + estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0), 0))
  const activeUsers = new Set(todayLogs.map(l => l.user_id).filter(Boolean)).size
  const successRate =
    logRows.length > 0 ? round1((logRows.filter(l => l.success).length / logRows.length) * 100) : 100

  const totalCalls = logRows.length
  const totalTokens = logRows.reduce((s, l) => s + (l.tokens_in ?? 0) + (l.tokens_out ?? 0), 0)

  // 趋势（近 12 天）
  const trend = bucketByDay(logRows, 12)

  // 模型分布：按 call_logs.model 分组
  const modelMap = new Map<string, { calls: number; cost: number }>()
  for (const l of logRows) {
    const m = l.model ?? '未知'
    const e = modelMap.get(m) ?? { calls: 0, cost: 0 }
    e.calls += 1
    e.cost += estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0)
    modelMap.set(m, e)
  }
  const modelShare: ModelShare[] = [...modelMap.entries()]
    .map(([model, v]) => ({ model, pct: totalCalls ? round1((v.calls / totalCalls) * 100) : 0, cost: round2(v.cost) }))
    .sort((a, b) => b.pct - a.pct)

  // 部门 Token 占比：call_logs.user_id → users.department
  const deptMap = new Map<string, number>()
  for (const l of logRows) {
    const dept = (l.user_id && userDept.get(l.user_id)) || '未知'
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + (l.tokens_in ?? 0) + (l.tokens_out ?? 0))
  }
  const deptShare: DeptShare[] = [...deptMap.entries()]
    .map(([dept, tokens]) => ({ dept, pct: totalTokens ? round1((tokens / totalTokens) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)

  // Agent 分布（饼图）：按 agent_id 调用量，Top5 + 其他
  const agentCallMap = new Map<string, number>()
  for (const l of logRows) {
    const id = l.agent_id ?? '未知'
    agentCallMap.set(id, (agentCallMap.get(id) ?? 0) + 1)
  }
  const agentCallSorted = [...agentCallMap.entries()].sort((a, b) => b[1] - a[1])
  const agentDistribution: AgentDist[] = agentCallSorted.slice(0, 5).map(([id, calls]) => ({
    name: agentName.get(id) ?? '未知',
    value: totalCalls ? round1((calls / totalCalls) * 100) : 0,
  }))
  const restCalls = agentCallSorted.slice(5).reduce((s, [, c]) => s + c, 0)
  if (restCalls > 0) {
    agentDistribution.push({ name: '其他', value: totalCalls ? round1((restCalls / totalCalls) * 100) : 0 })
  }

  // 热门 Agent：按调用量排名，含成功率
  const agentStat = new Map<string, { calls: number; success: number }>()
  for (const l of logRows) {
    const id = l.agent_id ?? '未知'
    const e = agentStat.get(id) ?? { calls: 0, success: 0 }
    e.calls += 1
    if (l.success) e.success += 1
    agentStat.set(id, e)
  }
  const topAgents: TopAgent[] = [...agentStat.entries()]
    .map(([id, v]) => ({
      name: agentName.get(id) ?? '未知',
      calls: v.calls,
      successRate: v.calls ? round1((v.success / v.calls) * 100) : 0,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5)

  // 热门 Skill：call_logs 无 skill 关联，用 installs（安装量）作为诚实的代理指标
  const topSkills: TopSkill[] = [...skillRows]
    .sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0))
    .slice(0, 5)
    .map(s => ({ name: s.name, calls: s.installs ?? 0, type: s.type ?? '—', installs: s.installs ?? 0 }))

  // 风险拦截：security_reviews status='rejected'
  const riskBlocked = rejectedRows.filter(r => (r.created_at ?? '') >= todayIso).length
  const riskRecords: RiskRecord[] = rejectedRows.slice(0, 10).map(r => {
    let resourceName = r.resource_id ? r.resource_id.slice(0, 8) : '—'
    if (r.resource_id) {
      if (r.type === 'agent' && agentName.has(r.resource_id)) resourceName = agentName.get(r.resource_id)!
      else if (r.type === 'skill' && skillName.has(r.resource_id)) resourceName = skillName.get(r.resource_id)!
    }
    return {
      time: r.created_at ? r.created_at.replace('T', ' ').slice(0, 19) : '—',
      riskLevel: r.risk_level ?? '—',
      resourceName,
      status: '已拦截',
    }
  })

  return {
    totalAgents,
    publishedAgents,
    pendingReviews: pendingRes.count ?? 0,
    todayCalls,
    todayTokens,
    successRate,
    totalSkills,
    publishedSkills,
    activeUsers,
    todayCost,
    riskBlocked,
    trend,
    modelShare,
    deptShare,
    agentDistribution,
    topAgents,
    topSkills,
    riskRecords,
  }
}
