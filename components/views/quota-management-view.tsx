'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  HardDrive,
  Bot,
  Users,
  TrendingUp,
  AlertTriangle,
  Settings,
  Bell,
  MoreHorizontal,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const usageTrendData = [
  { date: '05-01', token: 120, storage: 35, agent: 8 },
  { date: '05-02', token: 145, storage: 38, agent: 9 },
  { date: '05-03', token: 132, storage: 40, agent: 9 },
  { date: '05-04', token: 168, storage: 42, agent: 10 },
  { date: '05-05', token: 155, storage: 45, agent: 11 },
  { date: '05-06', token: 178, storage: 48, agent: 12 },
  { date: '05-07', token: 192, storage: 50, agent: 12 },
  { date: '05-08', token: 210, storage: 52, agent: 13 },
];

const deptQuotas = [
  {
    id: '1',
    name: '技术研发中心',
    tokenUsed: 2500000,
    tokenLimit: 5000000,
    storageUsed: 45,
    storageLimit: 100,
    agentUsed: 15,
    agentLimit: 30,
    userCount: 128,
    status: 'normal',
  },
  {
    id: '2',
    name: 'AI 研发部',
    tokenUsed: 1800000,
    tokenLimit: 2000000,
    storageUsed: 28,
    storageLimit: 30,
    agentUsed: 8,
    agentLimit: 10,
    userCount: 35,
    status: 'warning',
  },
  {
    id: '3',
    name: '产品运营中心',
    tokenUsed: 600000,
    tokenLimit: 2000000,
    storageUsed: 20,
    storageLimit: 50,
    agentUsed: 5,
    agentLimit: 15,
    userCount: 56,
    status: 'normal',
  },
  {
    id: '4',
    name: '市场销售中心',
    tokenUsed: 450000,
    tokenLimit: 1500000,
    storageUsed: 12,
    storageLimit: 40,
    agentUsed: 3,
    agentLimit: 10,
    userCount: 42,
    status: 'normal',
  },
  {
    id: '5',
    name: '后端开发部',
    tokenUsed: 980000,
    tokenLimit: 1000000,
    storageUsed: 18,
    storageLimit: 20,
    agentUsed: 5,
    agentLimit: 5,
    userCount: 45,
    status: 'critical',
  },
];

const quotaStats = [
  {
    label: 'Token 用量',
    used: 5200000,
    limit: 10000000,
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    unit: 'Token',
    trend: '+15.2%',
    trendUp: true,
  },
  {
    label: '存储空间',
    used: 123,
    limit: 200,
    icon: HardDrive,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    unit: 'GB',
    trend: '+8.5%',
    trendUp: true,
  },
  {
    label: 'Agent 数量',
    used: 36,
    limit: 50,
    icon: Bot,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    unit: '个',
    trend: '+3',
    trendUp: true,
  },
  {
    label: '用户数量',
    used: 256,
    limit: 500,
    icon: Users,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    unit: '人',
    trend: '+12',
    trendUp: true,
  },
];

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export function QuotaManagementView() {
  const [timeRange, setTimeRange] = useState('7d');

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      normal: { label: '正常', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      warning: { label: '预警', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      critical: { label: '超限', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    };
    return <Badge className={config[status].className}>{config[status].label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">资源配额管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">监控和管理企业资源使用配额</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bell className="h-4 w-4" />
            告警设置
          </Button>
          <Button size="sm" className="gap-1.5">
            <Settings className="h-4 w-4" />
            配额调整
          </Button>
        </div>
      </div>

      {/* 配额总览 */}
      <div className="grid grid-cols-4 gap-4">
        {quotaStats.map((stat) => {
          const percentage = (stat.used / stat.limit) * 100;
          const isWarning = percentage >= 80;
          const isCritical = percentage >= 95;

          return (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${stat.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-semibold text-foreground">
                      {formatNumber(stat.used)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {formatNumber(stat.limit)} {stat.unit}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress
                    value={percentage}
                    className={`h-1.5 ${isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-yellow-500' : ''}`}
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className={`text-xs ${isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                      {percentage.toFixed(1)}% 已使用
                    </span>
                    {isWarning && (
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {isCritical ? '即将超限' : '接近上限'}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 使用趋势图 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">使用趋势</CardTitle>
              <CardDescription>资源使用量变化趋势</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">近 7 天</SelectItem>
                <SelectItem value="30d">近 30 天</SelectItem>
                <SelectItem value="90d">近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={usageTrendData}>
              <defs>
                <linearGradient id="colorToken" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.2 250)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.6 0.18 180)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.6 0.18 180)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 250)" />
              <XAxis
                dataKey="date"
                stroke="oklch(0.5 0.01 260)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.5 0.01 260)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.14 0.015 250)',
                  border: '1px solid oklch(0.25 0.015 250)',
                  borderRadius: '8px',
                  color: 'oklch(0.95 0.005 260)',
                }}
              />
              <Area
                type="monotone"
                dataKey="token"
                name="Token (万)"
                stroke="oklch(0.65 0.2 250)"
                fillOpacity={1}
                fill="url(#colorToken)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="storage"
                name="存储 (GB)"
                stroke="oklch(0.6 0.18 180)"
                fillOpacity={1}
                fill="url(#colorStorage)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 部门配额列表 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">部门配额</CardTitle>
            <Button variant="outline" size="sm">
              导出报表
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>部门</TableHead>
                <TableHead>Token 用量</TableHead>
                <TableHead>存储空间</TableHead>
                <TableHead>Agent 数量</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptQuotas.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <div className="flex items-baseline gap-1 text-sm">
                        <span className="font-medium">{formatNumber(dept.tokenUsed)}</span>
                        <span className="text-muted-foreground text-xs">/ {formatNumber(dept.tokenLimit)}</span>
                      </div>
                      <Progress
                        value={(dept.tokenUsed / dept.tokenLimit) * 100}
                        className="h-1 mt-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <div className="flex items-baseline gap-1 text-sm">
                        <span className="font-medium">{dept.storageUsed}</span>
                        <span className="text-muted-foreground text-xs">/ {dept.storageLimit} GB</span>
                      </div>
                      <Progress
                        value={(dept.storageUsed / dept.storageLimit) * 100}
                        className="h-1 mt-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-20">
                      <div className="flex items-baseline gap-1 text-sm">
                        <span className="font-medium">{dept.agentUsed}</span>
                        <span className="text-muted-foreground text-xs">/ {dept.agentLimit}</span>
                      </div>
                      <Progress
                        value={(dept.agentUsed / dept.agentLimit) * 100}
                        className="h-1 mt-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dept.userCount} 人</TableCell>
                  <TableCell>{getStatusBadge(dept.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          调整配额
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          查看趋势
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Bell className="h-4 w-4 mr-2" />
                          设置告警
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
