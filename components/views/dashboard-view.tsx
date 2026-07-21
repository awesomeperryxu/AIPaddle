'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardData } from '@/lib/data/dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Boxes,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Shield,
  DollarSign,
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle2
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--muted-foreground)'];

// ============ 监控明细下钻子系统 ============

type DetailKey = 'calls' | 'tokens' | 'cost' | 'users' | 'success' | 'risk' | 'topAgents' | 'topSkills';

type DetailCell = { text: string; className?: string };

type SideItem = { label: string; value: string; pct: number; color: string };

interface DetailConfig {
  title: string;
  desc: string;
  chart?: { label: string; data: { name: string; value: number }[]; yDomain?: [number, number] };
  table: { head: string[]; rows: DetailCell[][] };
  side?: { title: string; items: SideItem[] };
}

const C_PRIMARY = 'var(--primary)';
const C_ACCENT = 'var(--accent)';
const C_CHART3 = 'var(--chart-3)';
const C_CHART4 = 'var(--chart-4)';
const C_GREEN = '#22c55e';

const clampPct = (n: number) => Math.min(100, Math.max(3, Math.round(n)));
const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// 从趋势中取今日 vs 昨日的环比（真实数据；不足两天则不显示）
function delta(trend: DashboardData['trend'], key: 'calls' | 'tokens' | 'cost' | 'activeUsers'): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1][key];
  const prev = trend[trend.length - 2][key];
  if (!prev) return null;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

function DeltaBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">{label}</span>;
  }
  const up = value >= 0;
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {up ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
      <span className={`text-xs ${up ? 'text-green-500' : 'text-red-500'}`}>
        {up ? '+' : ''}{value}%
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// 从真实 props 派生全部下钻明细（不依赖任何 mock）
function buildDetailConfigs(data: DashboardData): Record<DetailKey, DetailConfig> {
  const { trend, modelShare, deptShare, topAgents, topSkills, riskRecords, riskBlocked } = data;

  const dayHead = ['日期', '调用量', 'Token', '成本', '活跃用户'];
  const dayRows: DetailCell[][] = trend.map((t) => [
    { text: t.date, className: 'text-muted-foreground' },
    { text: fmtNum(t.calls) },
    { text: `${(t.tokens / 10000).toFixed(1)} 万` },
    { text: `¥${t.cost.toFixed(2)}` },
    { text: String(t.activeUsers) },
  ]);

  const maxAgentCalls = topAgents[0]?.calls ?? 0;
  const maxSkillInstalls = topSkills[0]?.installs ?? 0;

  const topAgentsSide: SideItem[] = topAgents.map((a) => ({
    label: a.name,
    value: fmtK(a.calls),
    pct: clampPct(maxAgentCalls ? (a.calls / maxAgentCalls) * 100 : 0),
    color: C_PRIMARY,
  }));

  const topSkillsSide: SideItem[] = topSkills.map((s) => ({
    label: s.name,
    value: fmtNum(s.installs),
    pct: clampPct(maxSkillInstalls ? (s.installs / maxSkillInstalls) * 100 : 0),
    color: C_ACCENT,
  }));

  const maxModelPct = modelShare[0]?.pct ?? 0;
  const maxDeptPct = deptShare[0]?.pct ?? 0;

  return {
    calls: {
      title: '调用量明细',
      desc: '近 12 天 Agent 调用量与逐日运营指标',
      chart: { label: '每日调用量（次）', data: trend.map((t) => ({ name: t.date, value: t.calls })) },
      table: { head: dayHead, rows: dayRows },
      side: { title: '按 Agent 分布（调用量）', items: topAgentsSide },
    },
    tokens: {
      title: 'Token 消耗明细',
      desc: '近 12 天 Token 消耗与模型分布',
      chart: { label: '每日 Token 消耗（万）', data: trend.map((t) => ({ name: t.date, value: Math.round(t.tokens / 10000) })) },
      table: { head: dayHead, rows: dayRows },
      side: {
        title: '按模型分布',
        items: modelShare.map((m) => ({ label: m.model, value: `${m.pct}%`, pct: clampPct(maxModelPct ? (m.pct / maxModelPct) * 100 : 0), color: C_ACCENT })),
      },
    },
    cost: {
      title: '成本明细',
      desc: '近 12 天成本走势与模型成本结构（按 token 单价估算）',
      chart: { label: '每日成本（¥，估算）', data: trend.map((t) => ({ name: t.date, value: t.cost })) },
      table: { head: dayHead, rows: dayRows },
      side: {
        title: '模型成本结构（估算）',
        items: modelShare.map((m) => ({ label: m.model, value: `¥${fmtNum(Math.round(m.cost))}`, pct: clampPct(maxModelPct ? (m.pct / maxModelPct) * 100 : 0), color: C_CHART3 })),
      },
    },
    users: {
      title: '活跃用户明细',
      desc: '近 12 天活跃用户与部门使用分布',
      chart: { label: '每日活跃用户（人）', data: trend.map((t) => ({ name: t.date, value: t.activeUsers })) },
      table: { head: dayHead, rows: dayRows },
      side: {
        title: '部门 Token 占比',
        items: deptShare.map((d) => ({ label: d.dept, value: `${d.pct}%`, pct: clampPct(maxDeptPct ? (d.pct / maxDeptPct) * 100 : 0), color: C_CHART4 })),
      },
    },
    success: {
      title: '调用成功率明细',
      desc: '近 12 天成功率走势（失败含超时 / 模型异常 / 命中风控；DB 未记录细分原因）',
      chart: {
        label: '每日成功率（%）',
        data: trend.map((t) => ({ name: t.date, value: t.successRate })),
        yDomain: [0, 100],
      },
      table: {
        head: ['日期', '成功率', '调用量', '失败数'],
        rows: trend.map((t) => {
          const failures = Math.round((t.calls * (100 - t.successRate)) / 100);
          return [
            { text: t.date, className: 'text-muted-foreground' },
            { text: `${t.successRate}%`, className: t.successRate < 95 ? 'text-warning' : 'text-green-500' },
            { text: fmtNum(t.calls) },
            { text: String(failures) },
          ];
        }),
      },
      side: {
        title: '按 Agent 成功率',
        items: topAgents.map((a) => ({ label: a.name, value: `${a.successRate}%`, pct: clampPct(a.successRate), color: C_GREEN })),
      },
    },
    risk: {
      title: '风险拦截明细',
      // DB 仅记录被拒审核，无细分风险类型/详情；今日拦截数为真实统计
      desc: `今日成功拦截 ${riskBlocked} 次高风险资源（数据源：安全审核 status=rejected）`,
      table: {
        head: ['时间', '风险等级', '目标资源', '处理'],
        rows: riskRecords.map((r) => [
          { text: r.time, className: 'text-muted-foreground' },
          {
            text: r.riskLevel,
            className: r.riskLevel === 'high' ? 'text-destructive' : r.riskLevel === 'medium' ? 'text-warning' : 'text-foreground',
          },
          { text: r.resourceName },
          { text: r.status, className: 'text-destructive' },
        ]),
      },
    },
    topAgents: {
      title: '热门 Agent 明细',
      desc: 'Agent 按调用量排行（含成功率）',
      table: {
        head: ['排名', 'Agent', '调用量', '成功率'],
        rows: topAgents.map((a, i) => [
          { text: String(i + 1), className: 'text-muted-foreground' },
          { text: a.name },
          { text: fmtNum(a.calls) },
          { text: a.calls ? `${a.successRate}%` : '—', className: a.successRate >= 95 ? 'text-green-500' : 'text-foreground' },
        ]),
      },
      side: { title: '调用量占比', items: topAgentsSide },
    },
    topSkills: {
      title: '热门 Skill 明细',
      // call_logs 无 skill 关联字段，调用量不可得；以安装量作为诚实代理指标
      desc: 'Skill 按安装量排行（DB 无 Skill 调用日志，安装量为代理指标）',
      table: {
        head: ['排名', 'Skill', '类型', '安装量'],
        rows: topSkills.map((s, i) => [
          { text: String(i + 1), className: 'text-muted-foreground' },
          { text: s.name },
          { text: s.type, className: 'text-muted-foreground' },
          { text: fmtNum(s.installs) },
        ]),
      },
      side: { title: '安装量占比', items: topSkillsSide },
    },
  };
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-[13px] text-muted-foreground text-center py-8">
        暂无数据
      </TableCell>
    </TableRow>
  );
}

function DetailPanel({ cfg, onBack }: { cfg: DetailConfig; onBack: () => void }) {
  return (
    <div className="space-y-5">
      {/* 面包屑 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={onBack} className="cursor-pointer hover:text-foreground">
                监控
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{cfg.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 标题 + 返回 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground">{cfg.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{cfg.desc}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          返回监控
        </Button>
      </div>

      {/* 柱状图 */}
      {cfg.chart && (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-3">{cfg.chart.label}</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cfg.chart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={cfg.chart.yDomain ?? undefined}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--foreground)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[3, 3, 0, 0]} name="数值" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 数据表格 + 右侧分布条 */}
      <div className={`grid gap-4 items-start ${cfg.side ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
        <Card className={`bg-card border-border shadow-sm overflow-hidden ${cfg.side ? 'lg:col-span-2' : ''}`}>
          <Table>
            <TableHeader>
              <TableRow>
                {cfg.table.head.map((h) => (
                  <TableHead key={h} className="text-xs text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cfg.table.rows.length === 0 ? (
                <EmptyRow colSpan={cfg.table.head.length} />
              ) : (
                cfg.table.rows.map((row, ri) => (
                  <TableRow key={ri}>
                    {row.map((cell, ci) => (
                      <TableCell key={ci} className={`text-[13px] ${cell.className ?? 'text-foreground'}`}>
                        {cell.text}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {cfg.side && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5">
              <h4 className="text-sm font-semibold text-foreground mb-3">{cfg.side.title}</h4>
              {cfg.side.items.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">暂无数据</p>
              ) : (
                <div className="space-y-2.5">
                  {cfg.side.items.map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-[110px] text-[13px] text-foreground shrink-0 truncate">{s.label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                      </div>
                      <span className="w-[70px] text-xs text-muted-foreground text-right shrink-0">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// 可点击卡片的统一交互样式
const clickableCard = 'bg-card border-border shadow-sm cursor-pointer transition-colors hover:border-primary/50';

export function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [detail, setDetail] = useState<DetailKey | null>(null);

  const {
    todayCalls,
    todayTokens,
    todayCost,
    activeUsers,
    publishedAgents,
    totalAgents,
    publishedSkills,
    totalSkills,
    successRate,
    pendingReviews,
    riskBlocked,
    trend,
    agentDistribution,
    topAgents,
    topSkills,
  } = data;

  if (detail) {
    const configs = buildDetailConfigs(data);
    return <DetailPanel cfg={configs[detail]} onBack={() => setDetail(null)} />;
  }

  const maxAgentCalls = topAgents[0]?.calls ?? 0;
  const maxSkillInstalls = topSkills[0]?.installs ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">监控</h1>
          <p className="text-sm text-muted-foreground mt-0.5">企业 AI 使用情况实时监控（数据来自调用日志与安全审核；成本为按 token 单价估算）</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs">系统正常</span>
          </Badge>
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-1.5" />
            最近 12 天
          </Button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={clickableCard} onClick={() => setDetail('calls')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日调用量</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{todayCalls.toLocaleString()}</p>
                <DeltaBadge value={delta(trend, 'calls')} label="vs 昨日" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('tokens')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Token 消耗</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{(todayTokens / 1000000).toFixed(2)}M</p>
                <DeltaBadge value={delta(trend, 'tokens')} label="vs 昨日" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('cost')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日成本（估算）</p>
                <p className="text-2xl font-semibold text-foreground mt-1">¥{todayCost.toFixed(2)}</p>
                <DeltaBadge value={delta(trend, 'cost')} label="vs 昨日" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('users')}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日活跃用户</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{activeUsers}</p>
                <DeltaBadge value={delta(trend, 'activeUsers')} label="vs 昨日" />
              </div>
              <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        <Card className={clickableCard} onClick={() => router.push('/agents-admin')}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{publishedAgents}/{totalAgents}</p>
              <p className="text-[11px] text-muted-foreground">已发布 Agent</p>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => router.push('/skill-hub')}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Boxes className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{publishedSkills}/{totalSkills}</p>
              <p className="text-[11px] text-muted-foreground">已发布 Skill</p>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('success')}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{successRate}%</p>
              <p className="text-[11px] text-muted-foreground">调用成功率</p>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => router.push('/security')}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{pendingReviews}</p>
              <p className="text-[11px] text-muted-foreground">待审核项</p>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('risk')}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{riskBlocked}</p>
              <p className="text-[11px] text-muted-foreground">今日风险拦截</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm text-foreground">调用量趋势</CardTitle>
                <CardDescription className="text-xs">过去 12 天的 Agent 调用量统计</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setDetail('calls')}>
                查看详情 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--foreground)',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#colorCalls)"
                    name="调用量"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={clickableCard} onClick={() => setDetail('topAgents')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Agent 使用分布</CardTitle>
            <CardDescription className="text-xs">按调用量占比统计</CardDescription>
          </CardHeader>
          <CardContent>
            {agentDistribution.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <>
                <div className="h-[180px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agentDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {agentDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--foreground)',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {agentDistribution.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      <span className="text-xs font-medium text-foreground ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top Agents */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground">热门 Agent</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setDetail('topAgents')}>
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <div className="space-y-3">
                {topAgents.slice(0, 4).map((agent, index) => (
                  <div key={agent.name} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                      index === 0 ? 'bg-yellow-500/10 text-yellow-600' :
                      index === 1 ? 'bg-gray-400/10 text-gray-500' :
                      index === 2 ? 'bg-amber-600/10 text-amber-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                      <div className="w-full bg-muted rounded-full h-1 mt-1">
                        <div
                          className="bg-primary h-1 rounded-full"
                          style={{ width: `${maxAgentCalls ? (agent.calls / maxAgentCalls) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{fmtK(agent.calls)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Skills */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground">热门 Skill</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setDetail('topSkills')}>
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无数据</p>
            ) : (
              <div className="space-y-3">
                {topSkills.slice(0, 4).map((skill, index) => (
                  <div key={skill.name} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                      index === 0 ? 'bg-yellow-500/10 text-yellow-600' :
                      index === 1 ? 'bg-gray-400/10 text-gray-500' :
                      index === 2 ? 'bg-amber-600/10 text-amber-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
                      <div className="w-full bg-muted rounded-full h-1 mt-1">
                        <div
                          className="bg-accent h-1 rounded-full"
                          style={{ width: `${maxSkillInstalls ? (skill.installs / maxSkillInstalls) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{fmtNum(skill.installs)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                风险预警
              </CardTitle>
              <Badge variant="outline" className="text-xs">{pendingReviews} 项</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReviews === 0 && riskBlocked === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无风险预警</p>
              ) : (
                <>
                  <div
                    onClick={() => router.push('/security')}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 cursor-pointer transition-colors hover:border-destructive/50"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">高风险资源待审核</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">前往安全管理处理</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-destructive/30 text-destructive">{pendingReviews}项</Badge>
                  </div>
                  <div
                    onClick={() => setDetail('risk')}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border cursor-pointer transition-colors hover:border-primary/40"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">今日风险拦截</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">成功拦截 {riskBlocked} 次高风险资源</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 shrink-0">正常</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
