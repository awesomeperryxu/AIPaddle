import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadPricingTable } from '@/lib/data/model-pricing'


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
type LogRow = {
  org_id: string; model: string | null; tokens_in: number | null; tokens_out: number | null
  created_at: string | null
  provider: string | null      // 4.8.17a：供应商，取价用
  key_source: string | null    // 4.8.17a：tenant=BYO（平台零成本）/ platform / null=迁移前历史
}

const DAY = 86_400_000
function ymKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

/**
 * 生成「近 N 个自然月」的 YYYY-MM 序列（含当月，末位=当月）。
 *
 * 🔴 不能用 `now - i*30*DAY` 倒推——自然月长度是 28~31 天，30 天定长会串月：
 * 2026-07-31 减 30 天仍是 2026-07-01，于是「上个月」和「本月」都算成 2026-07，
 * 6 个桶里出现重复月份、实际只覆盖 5 个月，且当月成本在图上被画两遍。
 * 该缺陷在每月 31 号（及 2 月前后）必现，属日期敏感型，平时跑测试看不见。
 *
 * 正确做法是按月份数做算术：用 setMonth 让 Date 自己处理跨年与月长。
 */
export function recentMonthKeys(now: number, count = 6): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(1)                    // 先归到 1 号，避免 31 号 setMonth 溢出到下月
    d.setMonth(d.getMonth() - i)
    out.push(ymKey(d))
  }
  return out
}

/** 平台运营大盘真实聚合。仅平台超管可调用（入口已 isPlatformAdmin）。 */
export async function getPlatformDashboard(): Promise<PlatformDashboard> {
  const admin = createAdminClient()
  const now = Date.now()
  const since180 = new Date(now - 180 * DAY).toISOString()

  const [tenantsRes, logsRes] = await Promise.all([
    admin.from('tenants').select('id,name,status,token_quota').is('deleted_at', null),
    admin.from('call_logs').select('org_id,model,tokens_in,tokens_out,created_at,provider,key_source').is('deleted_at', null).gte('created_at', since180),
  ])
  if (tenantsRes.error) throw new Error(tenantsRes.error.message)
  if (logsRes.error) throw new Error(logsRes.error.message)
  // 4.8.17c 收口：运营大盘的成本也走定价表，与租户管理页同一口径。
  // 此前这里还用硬编码 estimateCost，两处口径不一致——同一批调用在两个页面能算出不同的钱。
  const pricing = await loadPricingTable()

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
    // 只算平台 Key 的调用：BYO 是租户自己付钱，来源未知（迁移 0026 前）不硬塞
    estCost: logs30.reduce((s, l) => s + (l.key_source === 'platform' ? (pricing.costOf(l) ?? 0) : 0), 0),
  }

  // 近 6 个月 Token 趋势
  const months = recentMonthKeys(now)
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

  // 模型成本结构（近 30 天，按 model 聚合；成本只算平台 Key 的调用）
  const byModel = new Map<string, { tokens: number; cost: number }>()
  for (const l of logs30) {
    const key = l.model || '(未知模型)'
    const cur = byModel.get(key) ?? { tokens: 0, cost: 0 }
    cur.tokens += tokensOf(l)
    cur.cost += l.key_source === 'platform' ? (pricing.costOf(l) ?? 0) : 0
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
  tokens30d: number     // 近 30 天 Token 消耗（全部来源）
  calls30d: number      // 近 30 天调用次数（call_logs 行数，全部来源）
  estCost30d: number    // 近 30 天平台侧估算成本（元）——**只算 platform 来源**，BYO 不计
  // 4.8.17a/b：按 Key 来源拆分。平台只为 platform 来源付钱；tenant 来源是租户自带 Key。
  platformTokens30d: number  // 其中：平台 Key 产生的 token
  byoTokens30d: number       // 其中：租户自配 Key（BYO）产生的 token
  unknownTokens30d: number   // 其中：迁移 0026 之前的历史数据，来源未知
  unpricedCalls30d: number   // 平台侧但在 model_pricing 里找不到定价的调用数（成本被低估的量）
  keyMode: 'byo' | 'platform' | 'mixed' | 'none'  // 当前配置态（取自 tenant_model_providers，非历史日志）
}

/**
 * 每租户用量聚合（按 org_id）。一次拉取 users/agents/call_logs 于 JS 内聚合。
 * 返回 Record<orgId, TenantUsage>；没有任何用量记录的租户不出现在 map 中（前端回落 0）。
 * 仅平台超管可调用（入口已 isPlatformAdmin）。
 */
export async function getTenantUsage(): Promise<Record<string, TenantUsage>> {
  const admin = createAdminClient()
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()

  const [usersRes, agentsRes, logsRes, provRes] = await Promise.all([
    // 🔴 BUG：之前没过滤 is_service_account，成员数包含了 Extension 机器用户，
    // 而成员详情列表用了 is_service_account=false 过滤——两边口径不一致。
    admin.from('users').select('org_id').eq('is_service_account', false).is('deleted_at', null),
    admin.from('agents').select('org_id').is('deleted_at', null),
    admin.from('call_logs').select('org_id,tokens_in,tokens_out,key_source,provider,model,created_at').is('deleted_at', null).gte('created_at', since30),
    // 4.8.17b：当前是否自带 Key，取「配置态」而非历史日志——刚配好还没调用过的租户也要正确显示 BYO
    admin.from('tenant_model_providers').select('org_id,enabled').is('deleted_at', null),
  ])
  // 4.8.17c：单价改从 model_pricing 取，按调用当时生效的档计算（改价不篡改历史）
  const pricing = await loadPricingTable()
  if (usersRes.error) throw new Error(usersRes.error.message)
  if (agentsRes.error) throw new Error(agentsRes.error.message)
  if (logsRes.error) throw new Error(logsRes.error.message)
  if (provRes.error) throw new Error(provRes.error.message)

  const usage: Record<string, TenantUsage> = {}
  const ensure = (org: string) => (usage[org] ??= {
    members: 0, agents: 0, tokens30d: 0, calls30d: 0, estCost30d: 0,
    platformTokens30d: 0, byoTokens30d: 0, unknownTokens30d: 0, unpricedCalls30d: 0, keyMode: 'platform',
  })

  for (const u of (usersRes.data as { org_id: string }[] | null) ?? []) ensure(u.org_id).members++
  for (const a of (agentsRes.data as { org_id: string }[] | null) ?? []) ensure(a.org_id).agents++

  type LogRow = {
    org_id: string; tokens_in: number | null; tokens_out: number | null
    key_source: string | null; provider: string | null; model: string | null; created_at: string | null
  }
  for (const l of (logsRes.data as LogRow[] | null) ?? []) {
    const e = ensure(l.org_id)
    const tin = l.tokens_in ?? 0, tout = l.tokens_out ?? 0
    e.tokens30d += tin + tout
    e.calls30d += 1   // 调用次数=call_logs 行数，不分来源
    if (l.key_source === 'tenant') {
      e.byoTokens30d += tin + tout
    } else if (l.key_source === 'platform') {
      e.platformTokens30d += tin + tout
      // 只有平台 Key 的调用才是平台真金白银的支出；无匹配定价时记为 0 并计数，避免静默失真
      const c = pricing.costOf(l)
      if (c === null) e.unpricedCalls30d += 1
      else e.estCost30d += c
    } else {
      // 迁移 0026 之前的历史数据：来源未知，不硬塞进任何一边（不制造假精确）
      e.unknownTokens30d += tin + tout
    }
  }

  // 配置态：该租户有启用的自配供应商 → BYO
  const byoOrgs = new Set(
    ((provRes.data as { org_id: string; enabled: boolean }[] | null) ?? [])
      .filter((p) => p.enabled).map((p) => p.org_id),
  )
  for (const [org, u] of Object.entries(usage)) {
    u.keyMode = byoOrgs.has(org)
      ? (u.platformTokens30d > 0 ? 'mixed' : 'byo')   // 配了 BYO 但仍有平台调用=混用（如非兼容供应商回退）
      : (u.tokens30d > 0 ? 'platform' : 'none')
  }
  return usage
}

export type RevenuePoint = { label: string; cost: number }   // cost=平台侧估算成本（元）

/**
 * 近 6 个月**平台侧 Token 成本**趋势（按 call_logs.token × 固定单价推算，非真实账单）。
 *
 * ⚠️ 口径（4.8.17a/b 修正）：只统计 key_source='platform' 的调用——租户自带 Key（BYO）
 * 的调用平台零成本，此前把它们也算进来，等于把别人花的钱记成自己的。
 * key_source 为 NULL 的历史数据（迁移 0026 之前）同样不计入，避免制造假精确。
 *
 * 另注：这个数是**成本**不是收入。ADR-017 已取消平台计费，当前没有定价表与结算，
 * 所以「收入」在产品上尚不存在；UI 措辞已同步改为「平台 Token 成本趋势」。
 */
export async function getPlatformRevenueTrend(): Promise<RevenuePoint[]> {
  const admin = createAdminClient()
  const now = Date.now()
  const since180 = new Date(now - 180 * DAY).toISOString()

  const { data, error } = await admin
    .from('call_logs').select('tokens_in,tokens_out,created_at,provider,model')
    .eq('key_source', 'platform')          // 4.8.17a/b：BYO 与来源未知的调用不计入平台成本
    .is('deleted_at', null).gte('created_at', since180)
  if (error) throw new Error(error.message)
  const pricing = await loadPricingTable()

  const months = recentMonthKeys(now)
  const map = new Map(months.map((m) => [m, 0]))
  type TrendLog = {
    tokens_in: number | null; tokens_out: number | null; created_at: string | null
    provider: string | null; model: string | null
  }
  for (const l of (data as TrendLog[] | null) ?? []) {
    if (!l.created_at) continue
    const k = ymKey(new Date(l.created_at))
    // 4.8.17c：按调用当时生效的单价算，改价不会让历史月份跟着变
    if (map.has(k)) map.set(k, map.get(k)! + (pricing.costOf(l) ?? 0))
  }
  return months.map((m) => ({ label: m.slice(5) + '月', cost: Math.round((map.get(m) ?? 0) * 100) / 100 }))
}
