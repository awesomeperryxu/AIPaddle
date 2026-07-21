'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Building2,
  Users,
  Zap,
  DollarSign,
  MoreHorizontal,
  Settings,
  Gauge,
  Receipt,
  Cpu,
  ShieldCheck,
  Ban,
  Trash2,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface Tenant {
  id: string;
  name: string;
  adminEmail: string;
  package: 'trial' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'overdue';
  members: number;
  agents: number;
  tokenUsage: number;
  tokenQuota: number;
  monthlyBill: number;
  createdAt: string;
}

const mockTenants: Tenant[] = [
  { id: 't-001', name: '示范科技有限公司', adminEmail: 'admin@demo.com', package: 'enterprise', status: 'active', members: 1245, agents: 6, tokenUsage: 8450000, tokenQuota: 10000000, monthlyBill: 2890, createdAt: '2024-01-15' },
  { id: 't-002', name: '创新金融集团', adminEmail: 'admin@finance.com', package: 'pro', status: 'active', members: 856, agents: 4, tokenUsage: 5230000, tokenQuota: 8000000, monthlyBill: 1560, createdAt: '2024-02-01' },
  { id: 't-003', name: '未来科技公司', adminEmail: 'admin@future.com', package: 'basic', status: 'active', members: 234, agents: 2, tokenUsage: 1890000, tokenQuota: 3000000, monthlyBill: 450, createdAt: '2024-02-20' },
  { id: 't-004', name: '智慧零售有限公司', adminEmail: 'admin@retail.com', package: 'pro', status: 'overdue', members: 567, agents: 3, tokenUsage: 4120000, tokenQuota: 5000000, monthlyBill: 1230, createdAt: '2024-01-28' },
  { id: 't-005', name: '测试企业', adminEmail: 'test@test.com', package: 'trial', status: 'active', members: 15, agents: 1, tokenUsage: 45000, tokenQuota: 100000, monthlyBill: 0, createdAt: '2024-03-10' },
];

const packageConfig = {
  trial: { label: '试用版', className: 'bg-muted text-muted-foreground' },
  basic: { label: '基础版', className: 'bg-blue-500/10 text-blue-500' },
  pro: { label: '专业版', className: 'bg-primary/10 text-primary' },
  enterprise: { label: '企业版', className: 'bg-green-500/10 text-green-500' }
};

const statusConfig = {
  active: { label: '正常', className: 'bg-green-500/10 text-green-500' },
  suspended: { label: '已停用', className: 'bg-destructive/10 text-destructive' },
  overdue: { label: '欠费', className: 'bg-yellow-500/10 text-yellow-500' }
};

export function TenantsView() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTenants = mockTenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = mockTenants.reduce((acc, t) => acc + t.monthlyBill, 0);
  const totalMembers = mockTenants.reduce((acc, t) => acc + t.members, 0);
  const totalTokens = mockTenants.reduce((acc, t) => acc + t.tokenUsage, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">租户管理</h1>
          <p className="text-muted-foreground">管理平台企业租户</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          开通企业
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{mockTenants.length}</p>
                <p className="text-xs text-muted-foreground">企业租户</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{totalMembers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">总用户数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{(totalTokens / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-muted-foreground">本月 Token</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">¥{totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">本月收入</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索企业..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Tenants Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">企业</TableHead>
                <TableHead className="text-muted-foreground">套餐</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground">成员数</TableHead>
                <TableHead className="text-muted-foreground">Agent 数</TableHead>
                <TableHead className="text-muted-foreground">Token 用量</TableHead>
                <TableHead className="text-muted-foreground">本月账单</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.adminEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={packageConfig[tenant.package].className}>
                      {packageConfig[tenant.package].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[tenant.status].className}>
                      {statusConfig[tenant.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{tenant.members.toLocaleString()}</TableCell>
                  <TableCell className="text-foreground">{tenant.agents}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">{(tenant.tokenUsage / 1000000).toFixed(2)}M / {(tenant.tokenQuota / 1000000).toFixed(0)}M</p>
                      <div className="w-24 h-1.5 bg-muted rounded-full">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(tenant.tokenUsage / tenant.tokenQuota) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">¥{tenant.monthlyBill.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Gauge className="h-4 w-4 mr-2" />
                          配额管理
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Receipt className="h-4 w-4 mr-2" />
                          账单管理
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Cpu className="h-4 w-4 mr-2" />
                          模型配置
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          MCP 审批
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Ban className="h-4 w-4 mr-2" />
                          停用企业
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除租户
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

      {/* Revenue Chart Placeholder */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">收入趋势</CardTitle>
            <CardDescription>过去 6 个月收入变化</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between gap-2 px-4">
              {[45, 62, 78, 85, 92, 100].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm"
                    style={{ height: `${height}%` }}
                  >
                    <div
                      className="w-full bg-primary rounded-t-sm"
                      style={{ height: `${height * 0.8}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{['10月', '11月', '12月', '1月', '2月', '3月'][i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">套餐分布</CardTitle>
            <CardDescription>企业套餐类型统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: '企业版', count: 1, percentage: 20, color: 'bg-green-500' },
                { name: '专业版', count: 2, percentage: 40, color: 'bg-primary' },
                { name: '基础版', count: 1, percentage: 20, color: 'bg-blue-500' },
                { name: '试用版', count: 1, percentage: 20, color: 'bg-muted-foreground' },
              ].map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">{item.count} 家</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
