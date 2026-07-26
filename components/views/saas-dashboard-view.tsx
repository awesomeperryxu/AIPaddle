'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Zap, Activity, Wallet, AlertTriangle } from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { PlatformDashboard } from '@/lib/data/platform-dashboard'

const CURRENCY = '¥'
const fmtTokens = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)
const fmtCost = (n: number) => `${CURRENCY}${n.toFixed(2)}`

const PLAN_LABEL: Record<string, string> = { free: '免费版', standard: '标准版', pro: '专业版', enterprise: '企业版' }

const tooltipStyle = {
  backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px',
  color: 'var(--foreground)', fontSize: '12px',
} as const

export function SaasDashboardView({ data }: { data: PlatformDashboard }) {
  const { tenants, usage30d, tokenTrend, tenantRanking, modelCost, risks } = data
  const maxUsage = tenantRanking[0]?.tokenUsage ?? 0

  return (
    <div className="space-y-6" data-testid="saas-dashboard-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">运营看板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">平台 SaaS 运营数据总览（平台超管视角 · 真实聚合）</p>
        </div>
        <Badge variant="outline" className="text-xs">近 30 天 / 6 个月</Badge>
      </div>

      {/* 计费未上线诚实提示 */}
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 p-3">
        <Wallet className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">计费相关指标（MRR / ARPU / 逾期应收）即将上线</span>
          ——计费引擎属通道 G 4.8.7 / 阶段 6，未接通前本页只展示<span className="text-foreground">真实用量与租户</span>数据，不显示收入类估算。
        </p>
      </div>

      {/* KPI Cards（全部真实） */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={<Building2 className="h-5 w-5 text-primary" />} label="租户总数"
          value={String(tenants.total)} sub={`活跃 ${tenants.active} · 停用 ${tenants.suspended}`} />
        <KpiCard icon={<Zap className="h-5 w-5 text-chart-3" />} label="近 30 天平台 Token"
          value={fmtTokens(usage30d.tokens)} sub={`${usage30d.calls.toLocaleString('en-US')} 次调用`} />
        <KpiCard icon={<Activity className="h-5 w-5 text-accent" />} label="近 30 天调用次数"
          value={usage30d.calls.toLocaleString('en-US')} sub="来自 call_logs 真实记录" />
        <KpiCard icon={<Wallet className="h-5 w-5 text-primary" />} label="近 30 天估算成本"
          value={fmtCost(usage30d.estCost)} sub="按通义 Qwen 单价估算，非结算金额" />
      </div>

      {/* Token 趋势 + 套餐分布 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">平台 Token 趋势</CardTitle>
            <CardDescription className="text-xs">近 6 个月，来自 call_logs 真实聚合</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {usage30d.calls === 0 && tokenTrend.every((t) => t.tokens === 0) ? (
                <EmptyBox text="暂无调用记录" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokenTrend}>
                    <defs>
                      <linearGradient id="colorTok" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtTokens} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtTokens(v), 'Token']} />
                    <Area type="monotone" dataKey="tokens" stroke="var(--primary)" strokeWidth={2} fill="url(#colorTok)" name="Token" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">套餐分布</CardTitle>
            <CardDescription className="text-xs">按租户数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(['free', 'standard', 'pro', 'enterprise'] as const).map((p) => {
              const count = tenants.byPlan[p] ?? 0
              const pct = tenants.total > 0 ? Math.round((count / tenants.total) * 100) : 0
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-foreground shrink-0">{PLAN_LABEL[p]}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground text-right shrink-0">{count}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* 租户消耗排行 + 模型成本 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">租户消耗排行（近 30 天）</CardTitle>
          </CardHeader>
          <CardContent>
            {tenantRanking.length === 0 ? <EmptyBox text="暂无用量数据" /> : (
              <div className="space-y-2.5">
                {tenantRanking.map((t, i) => {
                  const pct = maxUsage > 0 ? Math.min(100, Math.round((t.tokenUsage / maxUsage) * 100)) : 0
                  return (
                    <div key={t.name + i} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground shrink-0">{i + 1}</span>
                      <span className="w-32 text-sm text-foreground truncate shrink-0">{t.name}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full">
                        <div className={`h-1.5 rounded-full ${t.over ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-14 text-xs text-muted-foreground text-right shrink-0">{fmtTokens(t.tokenUsage)}</span>
                      {t.over && <Badge className="text-[10px] bg-destructive/10 text-destructive shrink-0">超配额</Badge>}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">模型成本结构（近 30 天 · 估算）</CardTitle>
          </CardHeader>
          <CardContent>
            {modelCost.length === 0 ? <EmptyBox text="暂无调用记录" /> : (
              <div className="space-y-2.5">
                {modelCost.map((mc) => (
                  <div key={mc.model} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-foreground truncate shrink-0">{mc.model}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div className="h-1.5 rounded-full bg-chart-3" style={{ width: `${mc.pct}%` }} />
                    </div>
                    <span className="w-16 text-xs text-muted-foreground text-right shrink-0">{fmtCost(mc.cost)}</span>
                    <span className="w-10 text-xs text-foreground text-right shrink-0">{mc.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 运营风险与待办（真实计算） */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />运营风险与待办
          </CardTitle>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无风险项：无停用租户、无超配额租户</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {risks.map((al, i) => {
                const high = al.level === 'high'
                return (
                  <div key={al.title + i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${high ? 'bg-destructive/5 border-destructive/20' : 'bg-warning/5 border-warning/20'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${high ? 'bg-destructive' : 'bg-warning'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{al.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{al.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyBox({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{text}</div>
}
