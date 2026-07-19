'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardStats, mockUsageMetrics } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Clock,
  CheckCircle2
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const agentDistribution = [
  { name: '智能客服', value: 45 },
  { name: 'HR助手', value: 25 },
  { name: '财务助手', value: 18 },
  { name: '其他', value: 12 },
];

export function DashboardView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">监控</h1>
          <p className="text-sm text-muted-foreground mt-0.5">企业 AI 使用情况实时监控</p>
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
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日调用量</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{dashboardStats.todayCalls.toLocaleString()}</p>
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

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Token 消耗</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{(dashboardStats.todayTokens / 1000000).toFixed(2)}M</p>
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

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日成本</p>
                <p className="text-2xl font-semibold text-foreground mt-1">${dashboardStats.todayCost}</p>
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

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃用户</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{dashboardStats.activeUsers}</p>
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
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{dashboardStats.publishedAgents}/{dashboardStats.totalAgents}</p>
              <p className="text-[11px] text-muted-foreground">已发布 Agent</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Boxes className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{dashboardStats.publishedSkills}/{dashboardStats.totalSkills}</p>
              <p className="text-[11px] text-muted-foreground">已发布 Skill</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{dashboardStats.successRate}%</p>
              <p className="text-[11px] text-muted-foreground">调用成功率</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{dashboardStats.pendingReviews}</p>
              <p className="text-[11px] text-muted-foreground">待审核项</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{dashboardStats.riskBlocked}</p>
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
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
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
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="agentCalls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorCalls)"
                    name="调用量"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
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
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
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
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardStats.topAgents.slice(0, 4).map((agent, index) => (
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
                        style={{ width: `${(agent.calls / dashboardStats.topAgents[0].calls) * 100}%` }}
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
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                全部 <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardStats.topSkills.slice(0, 4).map((skill, index) => (
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
                        style={{ width: `${(skill.calls / dashboardStats.topSkills[0].calls) * 100}%` }}
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
              <Badge variant="outline" className="text-xs">{dashboardStats.pendingReviews} 项</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">高风险 Skill 待审核</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">HR系统接口、财务数据库查询</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-destructive/30 text-destructive">2项</Badge>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-warning/5 border border-warning/20">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Token 用量预警</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">本月已使用 85% 配额</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-warning/30 text-warning">注意</Badge>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">今日风险拦截</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">成功拦截 {dashboardStats.riskBlocked} 次可疑调用</p>
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
