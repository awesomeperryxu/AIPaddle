'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardStats, mockUsageMetrics, mockAgents, mockSkills } from '@/lib/mock-data';
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

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--chart-3)', 'var(--chart-4)'];

const agentDistribution = [
  { name: '智能客服', value: 45 },
  { name: 'HR助手', value: 25 },
  { name: '财务助手', value: 18 },
  { name: '其他', value: 12 },
];

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
const C_WARNING = 'var(--warning)';
const C_DESTRUCTIVE = 'var(--destructive)';
const C_GREEN = '#22c55e';

const clampPct = (n: number) => Math.min(100, Math.max(3, Math.round(n)));

// 近 12 天成功率（内联 mock，纵轴 90-100）
const successDays = [95.2, 96.0, 94.1, 96.4, 96.9, 97.2, 96.5, 95.8, 94.6, 93.9, 96.2, 97.1];

// 模型分布（内联 mock）
const modelShare = [
  { model: 'GPT-4-Turbo', pct: 38, cost: 22400 },
  { model: 'Claude-3-Opus', pct: 24, cost: 14100 },
  { model: '通义千问-Max', pct: 18, cost: 6800 },
  { model: 'Claude-3-Sonnet', pct: 12, cost: 4300 },
  { model: 'GPT-3.5-Turbo', pct: 8, cost: 1200 },
];

// 部门 Token 占比（内联 mock）
const deptTokenShare = [
  { dept: '客服部', pct: 32 },
  { dept: '人力资源部', pct: 22 },
  { dept: '财务部', pct: 18 },
  { dept: 'IT部', pct: 15 },
  { dept: '销售部', pct: 8 },
  { dept: '法务部', pct: 5 },
];

// 风险拦截明细（内联 mock，8 行）
const riskRecords: [string, string, string, string, string][] = [
  ['16:30:45', '非法指令', '智能客服助手', '用户输入含「删除全部工单」指令模式', '已拦截'],
  ['15:52:10', '敏感信息', 'Agent 输出', '检出身份证号，已自动脱敏后放行', '脱敏放行'],
  ['14:47:33', '越权调用', 'ERP库存查询', '销售部用户调用未授权 DB Skill', '已拦截'],
  ['13:45:30', '敏感信息', 'HR政策顾问', '输出含薪资区间，按策略打码', '脱敏放行'],
  ['12:20:15', '越权调用', '财务数据库查询', '非财务部访问，缺少字段白名单', '已拦截'],
  ['11:05:00', 'Prompt 注入', '用户输入', '检测到「忽略以上指令」注入尝试', '已拦截'],
  ['10:12:08', '频率异常', 'API Key k-2', '1 分钟内 420 次调用，触发限流', '限流 5 分钟'],
  ['09:33:51', '敏感信息', '文档解析器', '上传文件含银行卡号，禁止入库', '已拦截'],
];

const M = mockUsageMetrics;
const dayHead = ['日期', '调用量', 'Token', '成本', '活跃用户'];
const dayRows: DetailCell[][] = M.map((m) => [
  { text: `2024-${m.date.replace('/', '-')}`, className: 'text-muted-foreground' },
  { text: m.agentCalls.toLocaleString('en-US') },
  { text: `${(m.tokenUsage / 10000).toFixed(0)} 万` },
  { text: `$${m.cost}` },
  { text: String(m.activeUsers) },
]);

const MAX_AGENT_CALLS = 15680;
const MAX_SKILL_CALLS = 156000;

const topAgentsSide: SideItem[] = dashboardStats.topAgents.map((a) => ({
  label: a.name,
  value: `${(a.calls / 1000).toFixed(1)}k`,
  pct: clampPct((a.calls / MAX_AGENT_CALLS) * 100),
  color: C_PRIMARY,
}));

const topSkillsSide: SideItem[] = dashboardStats.topSkills.map((s) => ({
  label: s.name,
  value: `${(s.calls / 1000).toFixed(0)}k`,
  pct: clampPct((s.calls / MAX_SKILL_CALLS) * 100),
  color: C_ACCENT,
}));

const DETAIL_CONFIGS: Record<DetailKey, DetailConfig> = {
  calls: {
    title: '调用量明细',
    desc: '近 12 天 Agent 调用量与逐日运营指标',
    chart: { label: '每日调用量（次）', data: M.map((m) => ({ name: m.date, value: m.agentCalls })) },
    table: { head: dayHead, rows: dayRows },
    side: { title: '按 Agent 分布（调用量）', items: topAgentsSide },
  },
  tokens: {
    title: 'Token 消耗明细',
    desc: '近 12 天 Token 消耗与模型分布',
    chart: { label: '每日 Token 消耗（万）', data: M.map((m) => ({ name: m.date, value: Math.round(m.tokenUsage / 10000) })) },
    table: { head: dayHead, rows: dayRows },
    side: {
      title: '按模型分布',
      items: modelShare.map((m) => ({ label: m.model, value: `${m.pct}%`, pct: clampPct(m.pct * 2), color: C_ACCENT })),
    },
  },
  cost: {
    title: '成本明细',
    desc: '近 12 天成本走势与模型成本结构',
    chart: { label: '每日成本（$）', data: M.map((m) => ({ name: m.date, value: m.cost })) },
    table: { head: dayHead, rows: dayRows },
    side: {
      title: '模型成本结构（本月）',
      items: modelShare.map((m) => ({ label: m.model, value: `¥${m.cost.toLocaleString('en-US')}`, pct: clampPct(m.pct * 2), color: C_CHART3 })),
    },
  },
  users: {
    title: '活跃用户明细',
    desc: '近 12 天活跃用户与部门使用分布',
    chart: { label: '每日活跃用户（人）', data: M.map((m) => ({ name: m.date, value: m.activeUsers })) },
    table: { head: dayHead, rows: dayRows },
    side: {
      title: '部门 Token 占比',
      items: deptTokenShare.map((d) => ({ label: d.dept, value: `${d.pct}%`, pct: clampPct(d.pct * 2.5), color: C_CHART4 })),
    },
  },
  success: {
    title: '调用成功率明细',
    desc: '近 12 天成功率走势（失败含超时 / 模型异常 / 命中风控）',
    chart: {
      label: '每日成功率（%，纵轴 90-100）',
      data: M.map((m, i) => ({ name: m.date, value: successDays[i] })),
      yDomain: [90, 100],
    },
    table: {
      head: ['日期', '成功率', '调用量', '失败数', '主要原因'],
      rows: M.map((m, i) => [
        { text: `2024-${m.date.replace('/', '-')}`, className: 'text-muted-foreground' },
        { text: `${successDays[i]}%`, className: successDays[i] < 95 ? 'text-warning' : 'text-green-500' },
        { text: m.agentCalls.toLocaleString('en-US') },
        { text: String(Math.round((m.agentCalls * (100 - successDays[i])) / 100)) },
        {
          text: i === 9 ? '通义千问限流（已 Fallback）' : i === 2 ? '知识库重建索引超时' : '模型偶发超时',
          className: 'text-muted-foreground',
        },
      ]),
    },
    side: {
      title: '按 Agent 成功率',
      items: mockAgents
        .filter((a) => a.status === 'published')
        .map((a) => ({ label: a.name, value: `${a.successRate}%`, pct: clampPct((a.successRate - 90) * 10), color: C_GREEN })),
    },
  },
  risk: {
    title: '风险拦截明细',
    desc: '今日成功拦截 23 次可疑调用；高风险 Skill 审核请前往安全管理',
    table: {
      head: ['时间', '类型', '目标', '详情', '处理'],
      rows: riskRecords.map((r) => [
        { text: r[0], className: 'text-muted-foreground' },
        {
          text: r[1],
          className:
            r[1] === '敏感信息'
              ? 'text-warning'
              : r[1] === '非法指令' || r[1] === 'Prompt 注入'
                ? 'text-destructive'
                : 'text-foreground',
        },
        { text: r[2] },
        { text: r[3], className: 'text-muted-foreground' },
        { text: r[4], className: r[4] === '已拦截' ? 'text-destructive' : 'text-yellow-500' },
      ]),
    },
    side: {
      title: '拦截类型分布（今日）',
      items: [
        { label: '敏感信息检测', value: '42%', pct: 84, color: C_WARNING },
        { label: '越权调用', value: '27%', pct: 54, color: C_DESTRUCTIVE },
        { label: '非法指令', value: '18%', pct: 36, color: C_DESTRUCTIVE },
        { label: 'Prompt 注入', value: '9%', pct: 18, color: C_CHART4 },
        { label: '频率异常', value: '4%', pct: 8, color: C_ACCENT },
      ],
    },
  },
  topAgents: {
    title: '热门 Agent 明细',
    desc: '全部 Agent 的调用量、成功率与 Token 消耗排行',
    table: {
      head: ['排名', 'Agent', '部门 / 模型', '调用量', '成功率'],
      rows: [...mockAgents]
        .sort((a, b) => b.calls - a.calls)
        .map((a, i) => [
          { text: String(i + 1), className: 'text-muted-foreground' },
          { text: `${a.avatar} ${a.name}` },
          { text: `${a.department} · ${a.model}`, className: 'text-muted-foreground' },
          { text: a.calls.toLocaleString('en-US') },
          { text: a.calls ? `${a.successRate}%` : '—', className: a.successRate >= 95 ? 'text-green-500' : 'text-foreground' },
        ]),
    },
    side: { title: '调用量占比', items: topAgentsSide },
  },
  topSkills: {
    title: '热门 Skill 明细',
    desc: '全部 Skill 的调用量、安装量与类型排行',
    table: {
      head: ['排名', 'Skill', '类型 / 发布者', '调用量', '安装量'],
      rows: [...mockSkills]
        .sort((a, b) => b.calls - a.calls)
        .map((s, i) => [
          { text: String(i + 1), className: 'text-muted-foreground' },
          { text: s.name },
          { text: `${s.type} · ${s.publisher}`, className: 'text-muted-foreground' },
          { text: s.calls.toLocaleString('en-US') },
          { text: String(s.installs) },
        ]),
    },
    side: { title: '调用量占比', items: topSkillsSide },
  },
};

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
              {cfg.table.rows.map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci} className={`text-[13px] ${cell.className ?? 'text-foreground'}`}>
                      {cell.text}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {cfg.side && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5">
              <h4 className="text-sm font-semibold text-foreground mb-3">{cfg.side.title}</h4>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// 可点击卡片的统一交互样式
const clickableCard = 'bg-card border-border shadow-sm cursor-pointer transition-colors hover:border-primary/50';

export function DashboardView({ stats }: { stats?: Partial<typeof dashboardStats> }) {
  const router = useRouter();
  const [detail, setDetail] = useState<DetailKey | null>(null);
  // BUG-74：真实指标覆盖 mock（未提供的字段回落 mock，明细趋势图仍为示例）
  const S = { ...dashboardStats, ...(stats ?? {}) };

  if (detail) {
    return <DetailPanel cfg={DETAIL_CONFIGS[detail]} onBack={() => setDetail(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">监控</h1>
          <p className="text-sm text-muted-foreground mt-0.5">企业 AI 使用情况实时监控（核心指标已接真实数据；成本/活跃用户/趋势明细为示例）</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs">系统正常</span>
          </Badge>
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-1.5" />
            最近 7 天
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
                <p className="text-2xl font-semibold text-foreground mt-1">{S.todayCalls.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+12.5%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
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
                <p className="text-2xl font-semibold text-foreground mt-1">{(S.todayTokens / 1000000).toFixed(2)}M</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+8.3%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
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
                <p className="text-sm text-muted-foreground">今日成本</p>
                <p className="text-2xl font-semibold text-foreground mt-1">${S.todayCost}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">-3.2%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
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
                <p className="text-sm text-muted-foreground">活跃用户</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{S.activeUsers}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+23.1%</span>
                  <span className="text-xs text-muted-foreground">vs 上周</span>
                </div>
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
              <p className="text-base font-semibold text-foreground">{S.publishedAgents}/{S.totalAgents}</p>
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
              <p className="text-base font-semibold text-foreground">{S.publishedSkills}/{S.totalSkills}</p>
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
              <p className="text-base font-semibold text-foreground">{S.successRate}%</p>
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
              <p className="text-base font-semibold text-foreground">{S.pendingReviews}</p>
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
              <p className="text-base font-semibold text-foreground">{S.riskBlocked}</p>
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
                <AreaChart data={mockUsageMetrics}>
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
                    dataKey="agentCalls"
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
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                  <span className="text-xs font-medium text-foreground ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
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
            <div className="space-y-3">
              {S.topAgents.slice(0, 4).map((agent, index) => (
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
                        style={{ width: `${(agent.calls / S.topAgents[0].calls) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{(agent.calls / 1000).toFixed(1)}k</p>
                </div>
              ))}
            </div>
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
            <div className="space-y-3">
              {S.topSkills.slice(0, 4).map((skill, index) => (
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
                        style={{ width: `${(skill.calls / S.topSkills[0].calls) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{(skill.calls / 1000).toFixed(0)}k</p>
                </div>
              ))}
            </div>
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
              <Badge variant="outline" className="text-xs">{S.pendingReviews} 项</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div
                onClick={() => setDetail('risk')}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 cursor-pointer transition-colors hover:border-destructive/50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">高风险 Skill 待审核</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">HR系统接口、财务数据库查询</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-destructive/30 text-destructive">2项</Badge>
              </div>
              <div
                onClick={() => setDetail('tokens')}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer transition-colors hover:border-warning/50"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Token 用量预警</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">本月已使用 85% 配额</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-warning/30 text-warning">注意</Badge>
              </div>
              <div
                onClick={() => setDetail('risk')}
                className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border cursor-pointer transition-colors hover:border-primary/40"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">今日风险拦截</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">成功拦截 {S.riskBlocked} 次可疑调用</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0">正常</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
