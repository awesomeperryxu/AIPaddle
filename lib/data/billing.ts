import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { estimateCost } from '@/lib/data/dashboard'

// 4.8.7：本租户账单——按量真实用量 + 估算成本（call_logs，请求级 RLS）。
// 铁律（PRD v1.10 §2.9.0）：计费引擎未上线（阶段 6），此处**只按量估算、非结算账单**，诚实标注；
// 不伪造发票/收入/逾期。成本按通义 Qwen 单价估算（与监控看板同口径）。

export type BillingSummary = {
  currentMonth: { label: string; tokens: number; calls: number; estCost: number }
  trend: { label: string; tokens: number; estCost: number }[]   // 近 6 个月
  byModel: { model: string; tokens: number; estCost: number; pct: number }[]
  billingEnabled: false
}

type LogRow = { model: string | null; tokens_in: number | null; tokens_out: number | null; created_at: string | null }
const DAY = 86_400_000
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export async function getBillingSummary(ctx: RequestContext): Promise<BillingSummary> {
  const supabase = await createClient()
  const now = Date.now()
  const since = new Date(now - 180 * DAY).toISOString()
  const { data, error } = await supabase
    .from('call_logs')
    .select('model,tokens_in,tokens_out,created_at')
    .eq('org_id', ctx.orgId) // RLS + 显式 org_id 双层隔离
    .is('deleted_at', null)
    .gte('created_at', since)
  if (error) throw new Error(error.message)
  const logs = (data as LogRow[] | null) ?? []
  const tokensOf = (l: LogRow) => (l.tokens_in ?? 0) + (l.tokens_out ?? 0)
  const costOf = (l: LogRow) => estimateCost(l.tokens_in ?? 0, l.tokens_out ?? 0)

  // 当月
  const curKey = ym(new Date(now))
  const curLogs = logs.filter((l) => l.created_at && ym(new Date(l.created_at)) === curKey)
  const currentMonth = {
    label: curKey,
    tokens: curLogs.reduce((s, l) => s + tokensOf(l), 0),
    calls: curLogs.length,
    estCost: curLogs.reduce((s, l) => s + costOf(l), 0),
  }

  // 近 6 个月趋势
  const months: string[] = []
  for (let i = 5; i >= 0; i--) months.push(ym(new Date(now - i * 30 * DAY)))
  const trend = months.map((m) => {
    const ml = logs.filter((l) => l.created_at && ym(new Date(l.created_at)) === m)
    return { label: m.slice(5) + '月', tokens: ml.reduce((s, l) => s + tokensOf(l), 0), estCost: ml.reduce((s, l) => s + costOf(l), 0) }
  })

  // 当月按模型
  const byModelMap = new Map<string, { tokens: number; estCost: number }>()
  for (const l of curLogs) {
    const key = l.model || '(未知模型)'
    const cur = byModelMap.get(key) ?? { tokens: 0, estCost: 0 }
    cur.tokens += tokensOf(l); cur.estCost += costOf(l)
    byModelMap.set(key, cur)
  }
  const totalCost = [...byModelMap.values()].reduce((s, m) => s + m.estCost, 0)
  const byModel = [...byModelMap.entries()]
    .map(([model, v]) => ({ model, tokens: v.tokens, estCost: v.estCost, pct: totalCost > 0 ? Math.round((v.estCost / totalCost) * 100) : 0 }))
    .sort((a, b) => b.estCost - a.estCost)

  return { currentMonth, trend, byModel, billingEnabled: false }
}
