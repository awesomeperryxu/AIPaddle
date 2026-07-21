'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  Building2,
  Zap,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
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
} from 'recharts';

// ===== 内联 Mock 数据（平台运营方视角，不接后端）=====

// 4 个核心 KPI
const saasKpis = {
  mrr: 6810,
  mrrDelta: '+18.2%',
  activeTenants: 6,
  tenantsDelta: '+1',
  tokens30d: '24.1M',
  tokensDelta: '+11.4%',
  arpu: 1362,
  overdueSum: 2910,
};

// 收入趋势 MRR（近 12 个月，单位 ¥）
const mrrTrend = [
  { m: '08', v: 2400 },
  { m: '09', v: 2870 },
  { m: '10', v: 3120 },
  { m: '11', v: 3660 },
  { m: '12', v: 4020 },
  { m: '01', v: 4480 },
  { m: '02', v: 4890 },
  { m: '03', v: 5340 },
  { m: '04', v: 5760 },
  { m: '05', v: 6120 },
  { m: '06', v: 6440 },
  { m: '07', v: 6810 },
];

// 租户增长（近 6 个月 新增 vs 流失）
const tenantGrowth = [
  { m: '2月', add: 1, churn: 0 },
  { m: '3月', add: 2, churn: 0 },
  { m: '4月', add: 0, churn: 0 },
  { m: '5月', add: 1, churn: 1 },
  { m: '6月', add: 1, churn: 0 },
  { m: '7月', add: 1, churn: 0 },
];

// 租户消耗排行（本月），按 Token 用量降序
interface TenantUsage {
  name: string;
  tokenUsage: number;
  tokenQuota: number;
  monthlyBill: number;
}
const tenantUsage: TenantUsage[] = [
  { name: '品器资产', tokenUsage: 8450000, tokenQuota: 10000000, monthlyBill: 2890 },
  { name: '云帆物流', tokenUsage: 5400000, tokenQuota: 5000000, monthlyBill: 1680 },
  { name: '创新金融集团', tokenUsage: 5230000, tokenQuota: 8000000, monthlyBill: 1560 },
  { name: '智慧零售有限公司', tokenUsage: 4120000, tokenQuota: 5000000, monthlyBill: 1230 },
  { name: '华润三九', tokenUsage: 3260000, tokenQuota: 5000000, monthlyBill: 1450 },
  { name: '未来科技', tokenUsage: 1890000, tokenQuota: 3000000, monthlyBill: 450 },
];

// 模型成本结构（本月）
const modelCost = [
  { model: 'GPT-4-Turbo', cost: 3420, pct: 50 },
  { model: 'Claude-3-Opus', cost: 1580, pct: 23 },
  { model: 'Qwen-Max', cost: 890, pct: 13 },
  { model: 'GPT-4o', cost: 620, pct: 9 },
  { model: '其他', cost: 300, pct: 5 },
];

// 运营风险与待办
type AlertLevel = 'high' | 'mid';
interface OpsAlert {
  level: AlertLevel;
  title: string;
  detail: string;
  time: string;
}
const opsAlerts: OpsAlert[] = [
  {
    level: 'high',
    title: '智慧零售有限公司 · 连续 2 期逾期',
    detail: '逾期 ¥1,230 + 未付 ¥1,230，已发 2 次催缴，建议触发限流',
    time: '今天 09:00',
  },
  {
    level: 'high',
    title: '云帆物流 · Token 超配额 8%',
    detail: '本月已用 5.40M / 5.00M，超量部分按 1.5 倍计费中',
    time: '今天 08:30',
  },
  {
    level: 'mid',
    title: '华润三九医药 · 目录全量同步待校验',
    detail: 'SSO（企业微信）已接入，已导入 2,134 名员工，待校验部门映射',
    time: '07-10',
  },
  {
    level: 'mid',
    title: '创新金融集团 · 服务将于 45 天后到期',
    detail: '2026-08-01 到期，续约商机已同步销售',
    time: '06-17',
  },
];

const CURRENCY = '¥';
const maxTokenUsage = tenantUsage[0].tokenUsage;

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
} as const;

export function SaasDashboardView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">运营看板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">平台 SaaS 运营数据总览（平台运营方视角）</p>
        </div>
        <Button variant="outline" size="sm">
          <Clock className="h-4 w-4 mr-1.5" />
          近 12 个月
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">月度经常性收入 MRR</p>
                <p className="text-2xl font-semibold text-foreground mt-1">
                  {CURRENCY}
                  {saasKpis.mrr.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-green-500 mt-1.5">{saasKpis.mrrDelta} vs 上月</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃租户</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{saasKpis.activeTenants}</p>
                <p className="text-xs text-green-500 mt-1.5">{saasKpis.tenantsDelta} 本月净增</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">近 30 天平台 Token</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{saasKpis.tokens30d}</p>
                <p className="text-xs text-green-500 mt-1.5">{saasKpis.tokensDelta} vs 上期</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">逾期应收</p>
                <p className="text-2xl font-semibold text-destructive mt-1">
                  {CURRENCY}
                  {saasKpis.overdueSum.toLocaleString('en-US')}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  ARPU {CURRENCY}
                  {saasKpis.arpu.toLocaleString('en-US')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: MRR trend + tenant growth */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">收入趋势（MRR）</CardTitle>
            <CardDescription className="text-xs">近 12 个月，单位 {CURRENCY}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrTrend}>
                  <defs>
                    <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${CURRENCY}${value.toLocaleString('en-US')}`, 'MRR']}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorMrr)"
                    name="MRR"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">租户增长</CardTitle>
            <CardDescription className="text-xs">近 6 个月 新增 vs 流失</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenantGrowth} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="add" name="新增" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="churn" name="流失" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-sm bg-primary" />
                新增
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-sm bg-destructive" />
                流失
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant usage ranking + model cost structure */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">租户消耗排行（本月）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {tenantUsage.map((t, index) => {
                const pct = Math.min(100, Math.round((t.tokenUsage / maxTokenUsage) * 100));
                const over = t.tokenUsage > t.tokenQuota;
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground shrink-0">{index + 1}</span>
                    <span className="w-32 text-sm text-foreground truncate shrink-0">{t.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-xs text-muted-foreground text-right shrink-0">
                      {(t.tokenUsage / 1000000).toFixed(2)}M
                    </span>
                    <span className="w-16 text-xs text-foreground text-right shrink-0">
                      {CURRENCY}
                      {t.monthlyBill.toLocaleString('en-US')}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-warning">
              ⚠ 云帆物流已超配额 8%（超量 1.5 倍计费），智慧零售连续 2 期逾期
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">模型成本结构（本月）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {modelCost.map((mc) => (
                <div key={mc.model} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-foreground shrink-0">{mc.model}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full">
                    <div className="h-1.5 rounded-full bg-chart-3" style={{ width: `${mc.pct}%` }} />
                  </div>
                  <span className="w-16 text-xs text-muted-foreground text-right shrink-0">
                    {CURRENCY}
                    {mc.cost.toLocaleString('en-US')}
                  </span>
                  <span className="w-10 text-xs text-foreground text-right shrink-0">{mc.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ops risk & todo */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              运营风险与待办
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              去租户管理处理 <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {opsAlerts.map((al) => {
              const high = al.level === 'high';
              return (
                <div
                  key={al.title}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                    high ? 'bg-destructive/5 border-destructive/20' : 'bg-warning/5 border-warning/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${high ? 'bg-destructive' : 'bg-warning'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{al.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{al.detail}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                    {al.time}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
