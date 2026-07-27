import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { estimateCost } from '@/lib/data/dashboard'

// ADR-010 平台运营大盘（4.8.1）：跨租户真实聚合，用 service_role（ADR-002 唯一沙可）。
// ⚠️ 必须由 API/页面入口的 isPlatformAdmin 兜住；此层不做 RLS 隔离。
// 铁律（PRD v1.10 §2.9.0）：全部真实数据；计费类指标（MRR/ARPU/逾期）因计费未上线（4.8.7/阶段6），
// 不造假——以 billingEnabled=false 标记，UI 诚实标注「即将上线」。

export type PlatformDashboard = {
  tenants: { total: number; active: number; suspended: number }
  usage30d: { tokens: number; calls: number; estCost: number }
  tokenTrend: { label: string; tokens: number }[]        // 近 6 个月
  tenantRanking: { name: string; tokenUsage: number; tokenQuota: number; over: boolean }[]
  modelCost: { model: string; tokens: number; cost: number; pct: number }[]
  risks: { level: 'high' | 'mid'; title: string; detail: string }[]
  billingEnabled: false                                   // 计费尚未上线（诚实标记）
}

type TenantRow = { id: string; name: string; status: string; token_quota: number | null }
type LogRow = { org_id: string; model: string | null; tokens_in: number | null; tokens_out: number | null; created_at: string | null }

const DAY = 86_400_000
function ymKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

/** 平台运营大盘真实聚合。仅平台超管可调用（入口已 isPlatformAdmin）。 */
export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  const admin = createAdminClient()
  const now = Date.now()
  const since180 = new Date(now - 180 * DAY).toISOString()

  const [tenantsRes, logsRes] = await Promise.all([
    admin.from('tenants').select('id,name,status,token_quota').is('deleted_at', null),
    admin.from('call_logs').select('org_id,model,tokens_in,tokens_out,created_at').is('deleted_at', null).gte('created_at', since180),
  ])
  if (tenantsRes.error) throw new Error(tenantsRes.error.message)
  if (logsRes.error) throw new Error(logsRes.error.message)

  const tenants = (tenantsRes.data as TenantRow[] | null) ?? []
  const logs = (logsRes.data as LogRow[] | null) ?? []
  const tokensOf = (l: LogRow) => (l.tokens_in ?? 0) + (l.tokens_out ?? 0)

  // 租户统计（ADR-017：去套餐化，不再按 plan 聚合）
  let active = 0, suspended = 0
  const nameById = new Map<string, string>()
  const quotaById = new Map<string, number>()
  for (const t of tenants) {
    if (t.status === 'suspended') suspended++; else active++
    nameById.set(t.id, t.name)
    quotaById.set(t.id, t.token_quota ?? 0)
  }

  // 近 30 天用量
  const since30 = now - 30 * DAY
  const logs30 = logs.filter((l) => l.created_at && Date.parse(l.created_at) >= since30)
  const usage30d = {
    tokens: logs30.reduce((s, l) => s + tokensOf(l), 0),
    calls: logs30.length,
    estCost: logs30.reduce((s, l) => s + estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0), 0),
  }

  // 近 6 个月 Token 趋势
  const months: string[] = []
  for (let i = 5; i >= 0; i--) months.push(ymKey(new Date(now - i * 30 * DAY)))
  const trendMap = new Map(months.map((m) => [m, 0]))
  for (const l of logs) {
    if (!l.created_at) continue
    const k = ymKey(new Date(l.created_at))
    if (trendMap.has(k)) trendMap.set(k, trendMap.get(k)! + tokensOf(l))
  }
  const tokenTrend = months.map((m) => ({ label: m.slice(5) + '月', tokens: trendMap.get(m) ?? 0 }))

  // 租户消耗排行（近 30 天，按 org 聚合 token）
  const byOrg = new Map<string, number>()
  for (const l of logs30) byOrg.set(l.org_id, (byOrg.get(l.org_id) ?? 0) + tokensOf(l))
  const tenantRanking = [...byOrg.entries()]
    .map(([org, tokenUsage]) => {
      const quota = quotaById.get(org) ?? 0
      return { name: nameById.get(org) ?? '(未知租户)', tokenUsage, tokenQuota: quota, over: quota > 0 && tokenUsage > quota }
    })
    .sort((a, b) => b.tokenUsage - a.tokenUsage)
    .slice(0, 8)

  // 模型成本结构（近 30 天，按 model 聚合 estimateCost）
  const byModel = new Map<string, { tokens: number; cost: number }>()
  for (const l of logs30) {
    const key = l.model || '(未知模型)'
    const cur = byModel.get(key) ?? { tokens: 0, cost: 0 }
    cur.tokens += tokensOf(l)
    cur.cost += estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0)
    byModel.set(key, cur)
  }
  const totalCost = [...byModel.values()].reduce((s, m) => s + m.cost, 0)
  const modelCost = [...byModel.entries()]
    .map(([model, v]) => ({ model, tokens: v.tokens, cost: v.cost, pct: totalCost > 0 ? Math.round((v.cost / totalCost) * 100) : 0 }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 6)

  // 运营风险与待办（真实计算：停用租户 + 超/近配额租户）
  const risks: PlatformDashboard['risks'] = []
  for (const t of tenants) {
    if (t.status === 'suspended') risks.push({ level: 'high', title: `${t.name} · 已停用`, detail: '该租户处于停用状态，成员无法访问；如需恢复请在租户管理启用' })
  }
  for (const r of tenantRanking) {
    if (r.tokenQuota <= 0) continue
    const ratio = r.tokenUsage / r.tokenQuota
    if (ratio > 1) risks.push({ level: 'high', title: `${r.name} · Token 超配额`, detail: `近 30 天已用 ${(r.tokenUsage / 1e6).toFixed(2)}M / 配额 ${(r.tokenQuota / 1e6).toFixed(2)}M（超 ${Math.round((ratio - 1) * 100)}%）` })
    else if (ratio > 0.8) risks.push({ level: 'mid', title: `${r.name} · Token 接近配额`, detail: `近 30 天已用 ${Math.round(ratio * 100)}%（${(r.tokenUsage / 1e6).toFixed(2)}M / ${(r.tokenQuota / 1e6).toFixed(2)}M）` })
  }

  return { tenants: { total: tenants.length, active, suspended }, usage30d, tokenTrend, tenantRanking, modelCost, risks, billingEnabled: false }
}

// ============ 4.8.x 租户管理：每租户真实用量聚合（去 mock） ============
// 同属平台超管视图，与 getPlatformDashboard 一致用 admin client 跨租户只读聚合；
// 入口 API 必须 isPlatformAdmin 兜住。此层不做 RLS 隔离、只读、无跨租户写。

export type TenantUsage = {
  members: number       // 该租户成员数（users，未软删）
  agents: number        // 该租户 Agent 数（agents，未软删）
  tokens30d: number     // 近 30 天 Token 消耗
  estCost30d: number    // 近 30 天估算成本（元，按固定单价推算，非真实账单）
}

/**
 * 每租户用量聚合（按 org_id）。一次拉取 users/agents/call_logs 于 JS 内聚合。
 * 返回 Record<orgId, TenantUsage>；没有任何用量记录的租户不出现在 map 中（前端回落 0）。
 * 仅平台超管可调用（入口已 isPlatformAdmin）。
 */
export async function getTenantUsage(): Promise<Record<string, TenantUsage>> {
  const admin = createAdminClient()
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()

  const [usersRes, agentsRes, logsRes] = await Promise.all([
    admin.from('users').select('org_id').is('deleted_at', null),
    admin.from('agents').select('org_id').is('deleted_at', null),
    admin.from('call_logs').select('org_id,tokens_in,tokens_out').is('deleted_at', null).gte('created_at', since30),
  ])
  if (usersRes.error) throw new Error(usersRes.error.message)
  if (agentsRes.error) throw new Error(agentsRes.error.message)
  if (logsRes.error) throw new Error(logsRes.error.message)

  const usage: Record<string, TenantUsage> = {}
  const ensure = (org: string) => (usage[org] ??= { members: 0, agents: 0, tokens30d: 0, estCost30d: 0 })

  for (const u of (usersRes.data as { org_id: string }[] | null) ?? []) ensure(u.org_id).members++
  for (const a of (agentsRes.data as { org_id: string }[] | null) ?? []) ensure(a.org_id).agents++
  for (const l of (logsRes.data as { org_id: string; tokens_in: number | null; tokens_out: number | null }[] | null) ?? []) {
    const e = ensure(l.org_id)
    e.tokens30d += (l.tokens_in ?? 0) + (l.tokens_out ?? 0)
    e.estCost30d += estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0)
  }
  return usage
}

export type RevenuePoint = { label: string; cost: number }   // cost=估算成本（元）

/**
 * 近 6 个月估算收入趋势（按 call_logs.token 数 × 固定单价推算，非真实账单）。
 * 替代前端写死的柱高数组；仅平台超管可调用。
 */
export async function getPlatformRevenueTrend(): Promise<RevenuePoint[]> {
  const admin = createAdminClient()
  const now = Date.now()
  const since180 = new Date(now - 180 * DAY).toISOString()

  const { data, error } = await admin
    .from('call_logs').select('tokens_in,tokens_out,created_at')
    .is('deleted_at', null).gte('created_at', since180)
  if (error) throw new Error(error.message)

  const months: string[] = []
  for (let i = 5; i >= 0; i--) months.push(ymKey(new Date(now - i * 30 * DAY)))
  const map = new Map(months.map((m) => [m, 0]))
  for (const l of (data as { tokens_in: number | null; tokens_out: number | null; created_at: string | null }[] | null) ?? []) {
    if (!l.created_at) continue
    const k = ymKey(new Date(l.created_at))
    if (map.has(k)) map.set(k, map.get(k)! + estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0))
  }
  return months.map((m) => ({ label: m.slice(5) + '月', cost: Math.round((map.get(m) ?? 0) * 100) / 100 }))
}
