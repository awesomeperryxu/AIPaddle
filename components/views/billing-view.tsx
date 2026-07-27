'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Wallet, Zap, Activity } from 'lucide-react'
import type { BillingSummary } from '@/lib/data/billing'

const CURRENCY = '¥'
const fmtTokens = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)
const fmtCost = (n: number) => `${CURRENCY}${n.toFixed(2)}`

export function BillingView({ data }: { data: BillingSummary }) {
  const { currentMonth, trend, byModel } = data
  const maxTrendCost = Math.max(0, ...trend.map((t) => t.estCost))

  return (
    <div className="space-y-6" data-testid="billing-view">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">账单与用量</h1>
        <p className="text-muted-foreground">本组织按量用量与估算成本</p>
      </div>

      {/* 计费未上线诚实提示 */}
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 p-3">
        <Wallet className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">计费引擎尚未上线（通道 G 4.8.7 / 阶段 6）。</span>
          以下为基于 <span className="text-foreground">call_logs 真实调用量</span>、按通义 Qwen 单价的<span className="text-foreground">按量估算成本</span>，
          <span className="text-foreground">非结算账单</span>，实际计费以正式账单为准。
        </p>
      </div>

      {/* 当月真实用量 */}
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<Zap className="h-5 w-5 text-chart-3" />} label={`当月 Token（${currentMonth.label}）`} value={fmtTokens(currentMonth.tokens)} />
        <Stat icon={<Activity className="h-5 w-5 text-accent" />} label="当月调用次数" value={currentMonth.calls.toLocaleString('en-US')} />
        <Stat icon={<Wallet className="h-5 w-5 text-primary" />} label="当月估算成本" value={fmtCost(currentMonth.estCost)} />
      </div>

      {/* 近 6 个月估算成本趋势 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">近 6 个月估算成本</CardTitle>
          <CardDescription className="text-xs">来自 call_logs 真实聚合，按量估算</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {currentMonth.calls === 0 && trend.every((t) => t.tokens === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无调用记录</p>
          ) : trend.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="w-12 text-sm text-foreground shrink-0">{t.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${maxTrendCost > 0 ? Math.round((t.estCost / maxTrendCost) * 100) : 0}%` }} />
              </div>
              <span className="w-20 text-xs text-muted-foreground text-right shrink-0">{fmtTokens(t.tokens)}</span>
              <span className="w-16 text-xs text-foreground text-right shrink-0">{fmtCost(t.estCost)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 当月按模型估算成本 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">当月按模型估算成本</CardTitle>
        </CardHeader>
        <CardContent>
          {byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">当月暂无调用</p>
          ) : (
            <div className="space-y-2.5">
              {byModel.map((m) => (
                <div key={m.model} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-foreground truncate shrink-0">{m.model}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div className="h-1.5 rounded-full bg-chart-3" style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className="w-16 text-xs text-muted-foreground text-right shrink-0">{fmtCost(m.estCost)}</span>
                  <span className="w-10 text-xs text-foreground text-right shrink-0">{m.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
          <div>
            <p className="text-lg font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
