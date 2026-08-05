'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api/client'
import { METRIC_TITLE, type PlatformMetric } from '@/lib/platform-metrics'

// ADR-008：本视图为 client 组件，只接收服务端页传入的可序列化真实数据，绝不直连 DB。
type MetricTenant = { id: string; name: string; status: string; createdAt: string }
type Usage = {
  members: number; agents: number; tokens30d: number; calls30d: number; estCost30d: number
}
type ModelCost = { model: string; tokens: number; cost: number; pct: number }
type TokenTrend = { label: string; tokens: number }

const CURRENCY = '¥'
const fmtInt = (n: number) => n.toLocaleString('en-US')
const fmtCost = (n: number) => `${CURRENCY}${n.toFixed(2)}`
const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)

// 数值型指标（每租户一行「租户名 / 该指标值」）的取值与格式化
const NUMERIC_CFG: Record<
  Exclude<PlatformMetric, 'tenants'>,
  { col: string; get: (u?: Usage) => number; fmt: (n: number) => string }
> = {
  members: { col: '成员数', get: (u) => u?.members ?? 0, fmt: fmtInt },
  agents: { col: 'Agent 数', get: (u) => u?.agents ?? 0, fmt: fmtInt },
  tokens: { col: '30 天 Token', get: (u) => u?.tokens30d ?? 0, fmt: fmtInt },
  calls: { col: '30 天调用次数', get: (u) => u?.calls30d ?? 0, fmt: fmtInt },
  cost: { col: '30 天估算成本', get: (u) => u?.estCost30d ?? 0, fmt: fmtCost },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: '正常', className: 'bg-green-500/10 text-green-500' },
  suspended: { label: '已停用', className: 'bg-destructive/10 text-destructive' },
}

export function PlatformMetricDetailView({
  metric,
  tenants,
  usage,
  modelCost = [],
  tokenTrend = [],
}: {
  metric: PlatformMetric
  tenants: MetricTenant[]
  usage: Record<string, Usage>
  modelCost?: ModelCost[]
  tokenTrend?: TokenTrend[]
}) {
  const router = useRouter()
  const title = METRIC_TITLE[metric]

  return (
    <div className="space-y-6" data-testid="platform-metric-detail-view">
      {/* 顶部：返回 + 标题 + 合计 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()} aria-label="返回">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{title} · 明细</h1>
          <p className="text-sm text-muted-foreground mt-0.5">按租户拆分 · 平台超管视角 · 真实聚合</p>
        </div>
        {metric !== 'tenants' && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">合计</p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{summaryTotal(metric, tenants, usage)}</p>
          </div>
        )}
      </div>

      {metric === 'tenants'
        ? <TenantsTable tenants={tenants} />
        : <NumericTable metric={metric} tenants={tenants} usage={usage} />}

      {/* cost：附模型成本结构（复用运营看板样式） */}
      {metric === 'cost' && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">模型成本结构（近 30 天 · 估算）</CardTitle>
          </CardHeader>
          <CardContent>
            {modelCost.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">暂无调用记录</div>
            ) : (
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
      )}

      {/* tokens：附近 6 个月趋势小图（简单柱状） */}
      {metric === 'tokens' && tokenTrend.length > 0 && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">平台 Token 趋势（近 6 个月）</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const max = Math.max(1, ...tokenTrend.map((p) => p.tokens))
              return (
                <div className="h-40 flex items-end justify-between gap-2 px-2">
                  {tokenTrend.map((p) => (
                    <div key={p.label} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{fmtTokens(p.tokens)}</span>
                      <div className="w-full bg-primary/20 rounded-t-sm" style={{ height: `${Math.round((p.tokens / max) * 100)}%` }} />
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function summaryTotal(
  metric: Exclude<PlatformMetric, 'tenants'> | PlatformMetric,
  tenants: MetricTenant[],
  usage: Record<string, Usage>,
): string {
  const cfg = NUMERIC_CFG[metric as Exclude<PlatformMetric, 'tenants'>]
  if (!cfg) return ''
  const total = tenants.reduce((s, t) => s + cfg.get(usage[t.id]), 0)
  return cfg.fmt(total)
}

function NumericTable({
  metric, tenants, usage,
}: {
  metric: Exclude<PlatformMetric, 'tenants'>
  tenants: MetricTenant[]
  usage: Record<string, Usage>
}) {
  const cfg = NUMERIC_CFG[metric]
  const rows = tenants
    .map((t) => ({ id: t.id, name: t.name, value: cfg.get(usage[t.id]) }))
    .sort((a, b) => b.value - a.value)
  const total = rows.reduce((s, r) => s + r.value, 0)

  // members 指标：点击可展开查看具体账号
  type Member = { id: string; name: string; email: string; roles: string[]; department: string; status: string }
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const toggleExpand = useCallback(async (tenantId: string) => {
    if (expandedId === tenantId) { setExpandedId(null); return }
    setExpandedId(tenantId)
    setMembers([])
    setLoading(true)
    try {
      const r = await apiFetch<{ members: Member[] }>(`/api/tenants/${tenantId}/members`)
      setMembers(r.members ?? [])
    } catch { setMembers([]) }
    finally { setLoading(false) }
  }, [expandedId])

  const canExpand = metric === 'members'

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">租户</TableHead>
              <TableHead className="text-muted-foreground text-right">{cfg.col}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-10">暂无数据</TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <TableRow className={`border-border ${canExpand ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                      onClick={canExpand ? () => toggleExpand(r.id) : undefined}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell className={`text-right tabular-nums ${canExpand ? 'text-primary underline decoration-dotted underline-offset-4' : 'text-foreground'}`}>
                        {cfg.fmt(r.value)}
                      </TableCell>
                    </TableRow>
                    {expandedId === r.id && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={2} className="p-0">
                          <div className="px-6 py-3">
                            {loading ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
                              </div>
                            ) : members.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2">暂无成员</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1 pr-4 font-medium">姓名</th>
                                    <th className="text-left py-1 pr-4 font-medium">邮箱</th>
                                    <th className="text-left py-1 pr-4 font-medium">角色</th>
                                    <th className="text-left py-1 pr-4 font-medium">部门</th>
                                    <th className="text-left py-1 font-medium">状态</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map(m => (
                                    <tr key={m.id} className="border-t border-border/30">
                                      <td className="py-1.5 pr-4 text-foreground">{m.name || '—'}</td>
                                      <td className="py-1.5 pr-4 text-muted-foreground">{m.email}</td>
                                      <td className="py-1.5 pr-4">
                                        {m.roles.map(role => <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 h-4 mr-1">{role}</Badge>)}
                                      </td>
                                      <td className="py-1.5 pr-4 text-muted-foreground">{m.department || '—'}</td>
                                      <td className="py-1.5">
                                        <span className={`inline-flex items-center gap-1 ${m.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                                          {m.status === 'active' ? '正常' : m.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                <TableRow className="border-t-2 border-border hover:bg-transparent">
                  <TableCell className="font-semibold text-foreground">合计</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">{cfg.fmt(total)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function TenantsTable({ tenants }: { tenants: MetricTenant[] }) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">租户</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground text-right">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-10">暂无租户</TableCell>
              </TableRow>
            ) : (
              <>
                {tenants.map((t) => {
                  const c = statusConfig[t.status] ?? { label: t.status, className: 'bg-muted text-muted-foreground' }
                  return (
                    <TableRow key={t.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                      <TableCell><Badge className={c.className}>{c.label}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{t.createdAt}</TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="border-t-2 border-border hover:bg-transparent">
                  <TableCell className="font-semibold text-foreground">合计</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">{tenants.length} 家</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
