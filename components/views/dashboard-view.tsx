'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardStats, mockUsageMetrics } from '@/lib/mock-data';
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
  AlertTriangle
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
  YAxis
} from 'recharts';

export function DashboardView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">监控看板</h1>
        <p className="text-muted-foreground">企业 AI 使用情况概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日调用量</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{dashboardStats.todayCalls.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+12.5%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日 Token 消耗</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{(dashboardStats.todayTokens / 1000000).toFixed(2)}M</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+8.3%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日成本</p>
                <p className="text-2xl font-semibold text-foreground mt-1">${dashboardStats.todayCost}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">-3.2%</span>
                  <span className="text-xs text-muted-foreground">vs 昨日</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃用户</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{dashboardStats.activeUsers}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">+23.1%</span>
                  <span className="text-xs text-muted-foreground">vs 上周</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-chart-4/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{dashboardStats.publishedAgents}/{dashboardStats.totalAgents}</p>
                <p className="text-xs text-muted-foreground">已发布 Agent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{dashboardStats.publishedSkills}/{dashboardStats.totalSkills}</p>
                <p className="text-xs text-muted-foreground">已发布 Skill</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{dashboardStats.successRate}%</p>
                <p className="text-xs text-muted-foreground">调用成功率</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{dashboardStats.pendingReviews}</p>
                <p className="text-xs text-muted-foreground">待审核项目</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">调用量趋势</CardTitle>
            <CardDescription>过去 12 天的 Agent 调用量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockUsageMetrics}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
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

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Token 消耗 & 成本</CardTitle>
            <CardDescription>过去 12 天的资源使用情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockUsageMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-2))" name="成本 ($)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">热门 Agent</CardTitle>
            <CardDescription>按调用量排名</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardStats.topAgents.map((agent, index) => (
                <div key={agent.name} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                    index === 1 ? 'bg-gray-400/10 text-gray-400' :
                    index === 2 ? 'bg-amber-600/10 text-amber-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${(agent.calls / dashboardStats.topAgents[0].calls) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.calls.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">热门 Skill</CardTitle>
            <CardDescription>按调用量排名</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardStats.topSkills.map((skill, index) => (
                <div key={skill.name} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                    index === 1 ? 'bg-gray-400/10 text-gray-400' :
                    index === 2 ? 'bg-amber-600/10 text-amber-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-chart-2 h-1.5 rounded-full"
                        style={{ width: `${(skill.calls / dashboardStats.topSkills[0].calls) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{skill.calls.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            风险预警
          </CardTitle>
          <CardDescription>需要关注的安全事项</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-foreground">高风险 Skill 待审核</p>
                  <p className="text-xs text-muted-foreground">HR系统接口、财务数据库查询 包含敏感数据访问</p>
                </div>
              </div>
              <span className="text-xs text-destructive font-medium">2 项</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">Token 用量预警</p>
                  <p className="text-xs text-muted-foreground">本月已使用 85% 配额</p>
                </div>
              </div>
              <span className="text-xs text-yellow-500 font-medium">注意</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">今日风险拦截</p>
                  <p className="text-xs text-muted-foreground">成功拦截 {dashboardStats.riskBlocked} 次可疑调用</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium">正常</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
