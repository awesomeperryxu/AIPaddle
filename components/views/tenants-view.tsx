'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Building2,
  Users,
  Zap,
  DollarSign,
  MoreHorizontal,
  Settings,
  Key,
  Ban,
  Eye,
  TrendingUp,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Gauge,
  Receipt,
  Pause,
  Play,
  Trash,
  HardDrive,
  Download,
  CheckCircle,
  Upload,
  User,
  Package,
  Globe,
  Clock,
  AlertTriangle,
  X,
  ChevronRight,
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
  code: string;
  shortName: string;
  industry: string;
  companySize: string;
  country: string;
  province: string;
  city: string;
  timezone: string;
  adminEmail: string;
  contactName: string;
  contactPhone: string;
  package: 'free' | 'standard' | 'professional' | 'enterprise';
  billingMode: 'payAsYouGo' | 'monthly' | 'yearly';
  status: 'active' | 'suspended' | 'overdue' | 'trial';
  members: number;
  agents: number;
  tokenUsage: number;
  tokenQuota: number;
  storageUsage: number;
  storageQuota: number;
  qpsLimit: number;
  monthlyBill: number;
  totalBill: number;
  mcpEnabled: boolean;
  serviceStartDate: string;
  serviceEndDate: string;
  createdAt: string;
}

const mockTenants: Tenant[] = [
  { 
    id: 't-001', 
    name: '示范科技有限公司', 
    code: 'TENANT_20260108_0001',
    shortName: '示范科技',
    industry: 'internet',
    companySize: '201-500',
    country: '中国',
    province: '北京',
    city: '海淀区',
    timezone: 'Asia/Shanghai',
    adminEmail: 'admin@demo.com', 
    contactName: '张三',
    contactPhone: '138 0000 0001',
    package: 'enterprise', 
    billingMode: 'yearly',
    status: 'active', 
    members: 1245, 
    agents: 6, 
    tokenUsage: 8450000, 
    tokenQuota: 10000000, 
    storageUsage: 6.5,
    storageQuota: 10,
    qpsLimit: 100,
    monthlyBill: 28900, 
    totalBill: 125800,
    mcpEnabled: true,
    serviceStartDate: '2026-01-15',
    serviceEndDate: '2027-01-15',
    createdAt: '2026-01-15' 
  },
  { 
    id: 't-002', 
    name: '创新金融集团', 
    code: 'TENANT_20260201_0002',
    shortName: '创新金融',
    industry: 'finance',
    companySize: '501-1000',
    country: '中国',
    province: '上海',
    city: '浦东新区',
    timezone: 'Asia/Shanghai',
    adminEmail: 'admin@finance.com', 
    contactName: '李四',
    contactPhone: '138 0000 0002',
    package: 'professional', 
    billingMode: 'monthly',
    status: 'active', 
    members: 856, 
    agents: 4, 
    tokenUsage: 5230000, 
    tokenQuota: 8000000, 
    storageUsage: 4.2,
    storageQuota: 8,
    qpsLimit: 80,
    monthlyBill: 15600, 
    totalBill: 78500,
    mcpEnabled: true,
    serviceStartDate: '2026-02-01',
    serviceEndDate: '2027-02-01',
    createdAt: '2026-02-01' 
  },
  { 
    id: 't-003', 
    name: '未来科技公司', 
    code: 'TENANT_20260220_0003',
    shortName: '未来科技',
    industry: 'internet',
    companySize: '51-200',
    country: '中国',
    province: '广东',
    city: '深圳',
    timezone: 'Asia/Shanghai',
    adminEmail: 'admin@future.com', 
    contactName: '王五',
    contactPhone: '138 0000 0003',
    package: 'standard', 
    billingMode: 'monthly',
    status: 'active', 
    members: 234, 
    agents: 2, 
    tokenUsage: 1890000, 
    tokenQuota: 3000000, 
    storageUsage: 1.8,
    storageQuota: 5,
    qpsLimit: 50,
    monthlyBill: 4500, 
    totalBill: 18500,
    mcpEnabled: false,
    serviceStartDate: '2026-02-20',
    serviceEndDate: '2027-02-20',
    createdAt: '2026-02-20' 
  },
  { 
    id: 't-004', 
    name: '智慧零售有限公司', 
    code: 'TENANT_20260128_0004',
    shortName: '智慧零售',
    industry: 'retail',
    companySize: '201-500',
    country: '中国',
    province: '浙江',
    city: '杭州',
    timezone: 'Asia/Shanghai',
    adminEmail: 'admin@retail.com', 
    contactName: '赵六',
    contactPhone: '138 0000 0004',
    package: 'professional', 
    billingMode: 'monthly',
    status: 'overdue', 
    members: 567, 
    agents: 3, 
    tokenUsage: 4120000, 
    tokenQuota: 5000000, 
    storageUsage: 3.5,
    storageQuota: 6,
    qpsLimit: 60,
    monthlyBill: 12300, 
    totalBill: 56800,
    mcpEnabled: true,
    serviceStartDate: '2026-01-28',
    serviceEndDate: '2027-01-28',
    createdAt: '2026-01-28' 
  },
  { 
    id: 't-005', 
    name: '测试企业', 
    code: 'TENANT_20260310_0005',
    shortName: '测试',
    industry: 'education',
    companySize: '1-50',
    country: '中国',
    province: '江苏',
    city: '南京',
    timezone: 'Asia/Shanghai',
    adminEmail: 'test@test.com', 
    contactName: '测试用户',
    contactPhone: '138 0000 0005',
    package: 'free', 
    billingMode: 'payAsYouGo',
    status: 'trial', 
    members: 15, 
    agents: 1, 
    tokenUsage: 45000, 
    tokenQuota: 100000, 
    storageUsage: 0.1,
    storageQuota: 1,
    qpsLimit: 10,
    monthlyBill: 0, 
    totalBill: 0,
    mcpEnabled: false,
    serviceStartDate: '2026-03-10',
    serviceEndDate: '2026-04-10',
    createdAt: '2026-03-10' 
  },
];

const mockBills = [
  { id: 'BILL_20260501_0001', tenantId: 't-001', period: '2026-04-01 至 2026-04-30', amount: 8500, tokenUsage: 850000, status: 'unpaid', createdAt: '2026-05-01 10:00' },
  { id: 'BILL_20260401_0001', tenantId: 't-001', period: '2026-03-01 至 2026-03-31', amount: 7800, tokenUsage: 780000, status: 'paid', createdAt: '2026-04-01 10:00' },
  { id: 'BILL_20260301_0001', tenantId: 't-001', period: '2026-02-01 至 2026-02-28', amount: 6200, tokenUsage: 620000, status: 'paid', createdAt: '2026-03-01 10:00' },
  { id: 'BILL_20260201_0001', tenantId: 't-001', period: '2026-01-01 至 2026-01-31', amount: 5500, tokenUsage: 550000, status: 'paid', createdAt: '2026-02-01 10:00' },
];

const mockAuditLogs = [
  { id: '1', time: '2026-05-08 14:32:15', operator: '张三', action: '配额调整', content: 'Token 配额从 800 万调整为 1000 万', ip: '192.168.1.100' },
  { id: '2', time: '2026-05-07 10:15:22', operator: '系统', action: '自动续费', content: '自动扣款 ¥8,500，续费 1 个月', ip: '-' },
  { id: '3', time: '2026-05-05 09:00:00', operator: '李四', action: '成员邀请', content: '邀请 5 名新成员加入', ip: '192.168.1.101' },
  { id: '4', time: '2026-05-03 16:45:30', operator: '张三', action: '模型配置', content: '启用 GPT-4 模型访问权限', ip: '192.168.1.100' },
];

const packageConfig = {
  free: { label: '免费版', className: 'bg-muted text-muted-foreground' },
  standard: { label: '标准版', className: 'bg-blue-500/10 text-blue-500' },
  professional: { label: '专业版', className: 'bg-primary/10 text-primary' },
  enterprise: { label: '企业版', className: 'bg-chart-2/10 text-chart-2' }
};

const statusConfig = {
  active: { label: '正常', className: 'bg-chart-2/10 text-chart-2' },
  suspended: { label: '已停用', className: 'bg-destructive/10 text-destructive' },
  overdue: { label: '欠费', className: 'bg-chart-3/10 text-chart-3' },
  trial: { label: '试用', className: 'bg-muted text-muted-foreground' }
};

const billStatusConfig = {
  paid: { label: '已支付', className: 'bg-chart-2/10 text-chart-2' },
  unpaid: { label: '未支付', className: 'bg-chart-3/10 text-chart-3' },
  overdue: { label: '已逾期', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: '已作废', className: 'bg-muted text-muted-foreground' }
};

type ViewMode = 'list' | 'detail' | 'quota' | 'billing';

export function TenantsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('quota');

  const filteredTenants = mockTenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = mockTenants.reduce((acc, t) => acc + t.monthlyBill, 0);
  const totalMembers = mockTenants.reduce((acc, t) => acc + t.members, 0);
  const totalTokens = mockTenants.reduce((acc, t) => acc + t.tokenUsage, 0);
  const activeCount = mockTenants.filter(t => t.status === 'active').length;

  const handleViewDetail = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('detail');
  };

  const handleViewQuota = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('quota');
  };

  const handleViewBilling = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('billing');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedTenant(null);
  };

  // Render tenant list view
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">租户管理</h1>
            <p className="text-muted-foreground">企业租户治理与资源管理</p>
          </div>
          <Button className="gap-2" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4" />
            开通企业
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总租户数</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{mockTenants.length}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="h-3 w-3 text-chart-2" />
                    <span className="text-xs text-chart-2">+2</span>
                    <span className="text-xs text-muted-foreground">本月新增</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃租户</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{activeCount}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-xs text-muted-foreground">{((activeCount / mockTenants.length) * 100).toFixed(0)}% 活跃率</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">本月 Token</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{(totalTokens / 1000000).toFixed(1)}M</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="h-3 w-3 text-chart-2" />
                    <span className="text-xs text-chart-2">+15.2%</span>
                    <span className="text-xs text-muted-foreground">vs 上月</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-chart-3" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">本月收入</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">¥{(totalRevenue / 100).toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="h-3 w-3 text-chart-2" />
                    <span className="text-xs text-chart-2">+8.5%</span>
                    <span className="text-xs text-muted-foreground">vs 上月</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-chart-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索企业名称、联系人..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue placeholder="全部套餐" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部套餐</SelectItem>
              <SelectItem value="free">免费版</SelectItem>
              <SelectItem value="standard">标准版</SelectItem>
              <SelectItem value="professional">专业版</SelectItem>
              <SelectItem value="enterprise">企业版</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">正常</SelectItem>
              <SelectItem value="trial">试用</SelectItem>
              <SelectItem value="overdue">欠费</SelectItem>
              <SelectItem value="suspended">已停用</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tenants Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">企业信息</TableHead>
                  <TableHead className="text-muted-foreground">套餐</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">使用量</TableHead>
                  <TableHead className="text-muted-foreground">Token 消耗</TableHead>
                  <TableHead className="text-muted-foreground">本月账单</TableHead>
                  <TableHead className="text-muted-foreground">创建时间</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
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
                    <TableCell>
                      <div className="text-sm">
                        <div className="text-foreground">{tenant.agents} Agents</div>
                        <div className="text-muted-foreground">{tenant.members.toLocaleString()} 成员</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm text-foreground font-medium">{(tenant.tokenUsage / 1000000).toFixed(2)}M</p>
                        <div className="w-24">
                          <Progress value={(tenant.tokenUsage / tenant.tokenQuota) * 100} className="h-1.5" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground font-medium">¥{(tenant.monthlyBill / 100).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tenant.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                          <DropdownMenuItem onClick={() => handleViewDetail(tenant)}>
                            <Eye className="h-4 w-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            编辑信息
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleViewQuota(tenant)}>
                            <Gauge className="h-4 w-4 mr-2" />
                            配额管理
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewBilling(tenant)}>
                            <Receipt className="h-4 w-4 mr-2" />
                            账单管理
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            模型配置
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenant.status === 'active' ? (
                            <DropdownMenuItem className="text-chart-3">
                              <Pause className="h-4 w-4 mr-2" />
                              暂停服务
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-chart-2">
                              <Play className="h-4 w-4 mr-2" />
                              恢复服务
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="h-4 w-4 mr-2" />
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

        {/* Revenue Chart */}
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
                    <span className="text-xs text-muted-foreground">{['12月', '1月', '2月', '3月', '4月', '5月'][i]}</span>
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
                  { name: '企业版', count: 1, percentage: 20, color: 'bg-chart-2' },
                  { name: '专业版', count: 2, percentage: 40, color: 'bg-primary' },
                  { name: '标准版', count: 1, percentage: 20, color: 'bg-blue-500' },
                  { name: '免费版', count: 1, percentage: 20, color: 'bg-muted-foreground' },
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

        {/* Create Tenant Drawer */}
        <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>开通企业租户</SheetTitle>
              <SheetDescription>
                填写企业基本信息，系统将自动创建租户账号并发送通知邮件
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-8">
              {/* Section 1: Basic Info */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">企业基本信息</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">企业名称 *</Label>
                    <Input id="name" placeholder="请输入企业名称" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="code">企业编码 *</Label>
                    <Input id="code" placeholder="TENANT_20260508_0001" defaultValue={`TENANT_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_0006`} />
                    <p className="text-xs text-muted-foreground">系统自动生成，可手动修改</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="shortName">企业简称</Label>
                    <Input id="shortName" placeholder="请输入简称" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="industry">行业类型 *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择行业" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internet">互联网</SelectItem>
                        <SelectItem value="finance">金融</SelectItem>
                        <SelectItem value="retail">零售</SelectItem>
                        <SelectItem value="manufacturing">制造</SelectItem>
                        <SelectItem value="education">教育</SelectItem>
                        <SelectItem value="healthcare">医疗</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="size">企业规模 *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择规模" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-50">1-50人</SelectItem>
                        <SelectItem value="51-200">51-200人</SelectItem>
                        <SelectItem value="201-500">201-500人</SelectItem>
                        <SelectItem value="501-1000">501-1000人</SelectItem>
                        <SelectItem value="1000+">1000人以上</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">时区</Label>
                    <Select defaultValue="Asia/Shanghai">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Shanghai">Asia/Shanghai (UTC+8)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Section 2: Contact Info */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">联系人信息</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">联系人姓名 *</Label>
                    <Input id="contactName" placeholder="请输入姓名" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactPosition">职位</Label>
                    <Input id="contactPosition" placeholder="请输入职位" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">联系邮箱 *</Label>
                    <Input id="contactEmail" type="email" placeholder="用于登录和接收通知" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">联系电话</Label>
                    <Input id="contactPhone" placeholder="请输入手机号" />
                  </div>
                </div>
              </section>

              {/* Section 3: Plan & Quota */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">套餐与配额</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>套餐类型 *</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { value: 'free', label: '免费版', desc: '10万 Token/月' },
                        { value: 'standard', label: '标准版', desc: '300万 Token/月' },
                        { value: 'professional', label: '专业版', desc: '800万 Token/月' },
                        { value: 'enterprise', label: '企业版', desc: '无限 Token' },
                      ].map((plan) => (
                        <label key={plan.value} className="relative flex cursor-pointer">
                          <input type="radio" name="plan" value={plan.value} className="peer sr-only" defaultChecked={plan.value === 'standard'} />
                          <div className="w-full rounded-lg border-2 border-border p-3 text-center peer-checked:border-primary peer-checked:bg-primary/5 transition-colors">
                            <div className="font-medium text-foreground text-sm">{plan.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">{plan.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>计费模式 *</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'payAsYouGo', label: '按量付费' },
                        { value: 'monthly', label: '包月' },
                        { value: 'yearly', label: '包年' },
                      ].map((mode) => (
                        <label key={mode.value} className="relative flex cursor-pointer">
                          <input type="radio" name="billingMode" value={mode.value} className="peer sr-only" defaultChecked={mode.value === 'monthly'} />
                          <div className="w-full rounded-lg border-2 border-border p-3 text-center peer-checked:border-primary peer-checked:bg-primary/5 transition-colors">
                            <div className="font-medium text-foreground text-sm">{mode.label}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tokenQuota">初始 Token 配额 *</Label>
                      <Input id="tokenQuota" type="number" defaultValue="1000000" />
                      <p className="text-xs text-muted-foreground">单位：Token，最小 10 万</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quotaWarning">配额预警阈值</Label>
                      <Select defaultValue="80">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="70">70%</SelectItem>
                          <SelectItem value="80">80%</SelectItem>
                          <SelectItem value="90">90%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="qpsLimit">并发请求限制 (QPS)</Label>
                      <Input id="qpsLimit" type="number" defaultValue="50" />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="storageQuota">存储空间配额 (GB)</Label>
                      <Input id="storageQuota" type="number" defaultValue="5" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Advanced Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Settings className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">高级设置</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serviceEndDate">服务有效期</Label>
                    <Input id="serviceEndDate" type="date" defaultValue="2027-05-08" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dataIsolation">数据隔离级别</Label>
                    <Select defaultValue="logical">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="logical">逻辑隔离</SelectItem>
                        <SelectItem value="physical">物理隔离</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="mcpEnabled">启用 MCP</Label>
                      <p className="text-xs text-muted-foreground">
                        开启后租户可申请自定义 MCP
                      </p>
                    </div>
                    <Switch id="mcpEnabled" />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">备注信息</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="内部备注，租户不可见" 
                      rows={3}
                    />
                  </div>
                </div>
              </section>
            </div>
            
            <SheetFooter className="mt-8 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setCreateDrawerOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setCreateDrawerOpen(false)}>
                创建租户
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Render tenant detail view
  if (viewMode === 'detail' && selectedTenant) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={handleBack} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            租户管理
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">企业详情</span>
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{selectedTenant.name}</h1>
                <Badge className={statusConfig[selectedTenant.status].className}>
                  {statusConfig[selectedTenant.status].label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTenant.code} · {selectedTenant.industry === 'internet' ? '互联网' : selectedTenant.industry === 'finance' ? '金融' : selectedTenant.industry} · {selectedTenant.companySize}人
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            编辑信息
          </Button>
        </div>
        
        {/* Main Content */}
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <Card className="w-80 h-fit bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">联系邮箱</div>
                  <div className="text-sm text-foreground">{selectedTenant.adminEmail}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">联系电话</div>
                  <div className="text-sm text-foreground">+86 {selectedTenant.contactPhone}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">所在地区</div>
                  <div className="text-sm text-foreground">{selectedTenant.country} · {selectedTenant.province} · {selectedTenant.city}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">服务有效期</div>
                  <div className="text-sm text-foreground">{selectedTenant.serviceStartDate} 至 {selectedTenant.serviceEndDate}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Package className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">当前套餐</div>
                  <div className="text-sm">
                    <Badge className={packageConfig[selectedTenant.package].className}>
                      {packageConfig[selectedTenant.package].label}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Right Content */}
          <div className="flex-1">
            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="w-full">
              <TabsList>
                <TabsTrigger value="info">基本信息</TabsTrigger>
                <TabsTrigger value="quota">配额使用</TabsTrigger>
                <TabsTrigger value="billing">账单记录</TabsTrigger>
                <TabsTrigger value="logs">操作日志</TabsTrigger>
                <TabsTrigger value="settings">设置</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="mt-6 space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base text-foreground">企业信息</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground">企业名称</div>
                        <div className="text-sm text-foreground mt-1">{selectedTenant.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">企业编码</div>
                        <div className="text-sm text-foreground mt-1 font-mono">{selectedTenant.code}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">企业简称</div>
                        <div className="text-sm text-foreground mt-1">{selectedTenant.shortName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">行业类型</div>
                        <div className="text-sm text-foreground mt-1">{selectedTenant.industry === 'internet' ? '互联网' : selectedTenant.industry === 'finance' ? '金融' : selectedTenant.industry}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">联系人</div>
                        <div className="text-sm text-foreground mt-1">{selectedTenant.contactName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">MCP 状态</div>
                        <div className="text-sm mt-1">
                          <Badge className={selectedTenant.mcpEnabled ? 'bg-chart-2/10 text-chart-2' : 'bg-muted text-muted-foreground'}>
                            {selectedTenant.mcpEnabled ? '已启用' : '未启用'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="quota" className="mt-6 space-y-6">
                {/* Token Usage */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-foreground">Token 使用情况</CardTitle>
                      <Button variant="link" size="sm" onClick={() => handleViewQuota(selectedTenant)}>查看详情</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">{((selectedTenant.tokenUsage / selectedTenant.tokenQuota) * 100).toFixed(0)}%</div>
                        <div className="text-sm text-muted-foreground mt-1">使用率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">{(selectedTenant.tokenUsage / 1000000).toFixed(1)}M</div>
                        <div className="text-sm text-muted-foreground mt-1">已用 Token</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">{((selectedTenant.tokenQuota - selectedTenant.tokenUsage) / 1000000).toFixed(1)}M</div>
                        <div className="text-sm text-muted-foreground mt-1">剩余 Token</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={(selectedTenant.tokenUsage / selectedTenant.tokenQuota) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
                
                {/* Storage Usage */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-foreground">存储使用情况</CardTitle>
                      <Button variant="link" size="sm">查看详情</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">已用 {selectedTenant.storageUsage}GB / 总计 {selectedTenant.storageQuota}GB</span>
                        <span className="text-sm font-medium text-foreground">{((selectedTenant.storageUsage / selectedTenant.storageQuota) * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={(selectedTenant.storageUsage / selectedTenant.storageQuota) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
                
                {/* QPS Monitor */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base text-foreground">并发请求监控</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground">当前限制</div>
                        <div className="text-2xl font-bold text-foreground mt-1">{selectedTenant.qpsLimit} QPS</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">峰值 QPS (近 1 小时)</div>
                        <div className="text-2xl font-bold text-foreground mt-1">{Math.floor(selectedTenant.qpsLimit * 0.87)} QPS</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="billing" className="mt-6 space-y-6">
                {/* Billing Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-foreground">¥{(selectedTenant.totalBill / 100).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground mt-1">累计消费</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-foreground">¥{(selectedTenant.monthlyBill / 100).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground mt-1">本月消费</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-chart-3">¥{(mockBills.filter(b => b.status === 'unpaid').reduce((acc, b) => acc + b.amount, 0) / 100).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground mt-1">待支付</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-foreground">¥0</div>
                      <div className="text-sm text-muted-foreground mt-1">逾期金额</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Bills Table */}
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">账单编号</TableHead>
                          <TableHead className="text-muted-foreground">账单周期</TableHead>
                          <TableHead className="text-muted-foreground">金额</TableHead>
                          <TableHead className="text-muted-foreground">Token 消耗</TableHead>
                          <TableHead className="text-muted-foreground">状态</TableHead>
                          <TableHead className="text-muted-foreground">创建时间</TableHead>
                          <TableHead className="text-muted-foreground text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockBills.map((bill) => (
                          <TableRow key={bill.id} className="border-border">
                            <TableCell className="font-mono text-sm text-foreground">{bill.id}</TableCell>
                            <TableCell className="text-foreground">{bill.period}</TableCell>
                            <TableCell className="font-medium text-foreground">¥{(bill.amount / 100).toLocaleString()}</TableCell>
                            <TableCell className="text-foreground">{(bill.tokenUsage / 1000).toLocaleString()}K</TableCell>
                            <TableCell>
                              <Badge className={billStatusConfig[bill.status as keyof typeof billStatusConfig].className}>
                                {billStatusConfig[bill.status as keyof typeof billStatusConfig].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{bill.createdAt}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="w-4 h-4 mr-2" />
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Download className="w-4 h-4 mr-2" />
                                    下载 PDF
                                  </DropdownMenuItem>
                                  {bill.status === 'unpaid' && (
                                    <DropdownMenuItem>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      标记已支付
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="logs" className="mt-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-foreground">操作日志</CardTitle>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        导出
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">操作时间</TableHead>
                          <TableHead className="text-muted-foreground">操作人</TableHead>
                          <TableHead className="text-muted-foreground">操作类型</TableHead>
                          <TableHead className="text-muted-foreground">操作内容</TableHead>
                          <TableHead className="text-muted-foreground">IP 地址</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockAuditLogs.map((log) => (
                          <TableRow key={log.id} className="border-border">
                            <TableCell className="text-muted-foreground">{log.time}</TableCell>
                            <TableCell className="text-foreground">{log.operator}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-foreground">{log.content}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">{log.ip}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="settings" className="mt-6 space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base text-foreground">通知设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">配额预警通知</div>
                        <div className="text-xs text-muted-foreground">当配额使用达到阈值时发送邮件通知</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">账单通知</div>
                        <div className="text-xs text-muted-foreground">每月生成账单后发送邮件通知</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-base text-destructive">危险操作</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">暂停服务</div>
                        <div className="text-xs text-muted-foreground">暂停该租户的所有服务，可随时恢复</div>
                      </div>
                      <Button variant="outline" size="sm" className="text-chart-3 border-chart-3/50">
                        <Pause className="w-4 h-4 mr-2" />
                        暂停
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">删除租户</div>
                        <div className="text-xs text-muted-foreground">永久删除该租户及所有数据，此操作不可恢复</div>
                      </div>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/50">
                        <Trash className="w-4 h-4 mr-2" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    );
  }

  // Render quota management view
  if (viewMode === 'quota' && selectedTenant) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={handleBack} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            租户管理
          </button>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => handleViewDetail(selectedTenant)} className="hover:text-foreground">
            {selectedTenant.shortName}
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">配额管理</span>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground">配额管理</h1>
        
        <div className="grid grid-cols-3 gap-6">
          {/* Token Quota Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base text-foreground">Token 配额</CardTitle>
                </div>
                <Button size="sm" variant="outline" onClick={() => setQuotaDialogOpen(true)}>调整配额</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">已用</span>
                  <span className="font-medium text-foreground">{selectedTenant.tokenUsage.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">总计</span>
                  <span className="font-medium text-foreground">{selectedTenant.tokenQuota.toLocaleString()}</span>
                </div>
                <Progress value={(selectedTenant.tokenUsage / selectedTenant.tokenQuota) * 100} className="h-2" />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">近 7 天用量趋势</div>
                <div className="h-16 flex items-end justify-between gap-1">
                  {[65, 72, 68, 85, 78, 82, 75].map((h, i) => (
                    <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Storage Quota Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base text-foreground">存储配额</CardTitle>
                </div>
                <Button size="sm" variant="outline">调整配额</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">已用</span>
                  <span className="font-medium text-foreground">{selectedTenant.storageUsage} GB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">总计</span>
                  <span className="font-medium text-foreground">{selectedTenant.storageQuota} GB</span>
                </div>
                <Progress value={(selectedTenant.storageUsage / selectedTenant.storageQuota) * 100} className="h-2" />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">文件类型分布</div>
                <div className="space-y-1">
                  {[
                    { name: '文档', size: 2.5, color: 'bg-primary' },
                    { name: '图片', size: 1.8, color: 'bg-chart-2' },
                    { name: '其他', size: 2.2, color: 'bg-chart-3' },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="text-foreground">{item.size} GB</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* QPS Limit Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base text-foreground">并发限制</CardTitle>
                </div>
                <Button size="sm" variant="outline">调整限制</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">当前限制</span>
                  <span className="font-medium text-foreground">{selectedTenant.qpsLimit} QPS</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">峰值 QPS</span>
                  <span className="font-medium text-foreground">{Math.floor(selectedTenant.qpsLimit * 0.87)} QPS</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">近 1 小时 QPS 曲线</div>
                <div className="h-16 flex items-end justify-between gap-0.5">
                  {Array.from({ length: 12 }, (_, i) => Math.floor(Math.random() * 40 + 40)).map((h, i) => (
                    <div key={i} className="flex-1 bg-chart-4/30 rounded-t" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Quota Adjustment Dialog */}
        <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>调整 Token 配额</DialogTitle>
              <DialogDescription>
                调整 {selectedTenant.name} 的 Token 配额
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentQuota">当前配额</Label>
                <Input id="currentQuota" value={selectedTenant.tokenQuota.toLocaleString()} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newQuota">新配额 *</Label>
                <Input id="newQuota" type="number" defaultValue={selectedTenant.tokenQuota} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">调整原因 *</Label>
                <Textarea id="reason" placeholder="请输入调整原因" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>取消</Button>
              <Button onClick={() => setQuotaDialogOpen(false)}>确认调整</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render billing management view
  if (viewMode === 'billing' && selectedTenant) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={handleBack} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            租户管理
          </button>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => handleViewDetail(selectedTenant)} className="hover:text-foreground">
            {selectedTenant.shortName}
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">账单管理</span>
        </div>
        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">账单管理</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              批量下载
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">¥{(selectedTenant.totalBill / 100).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">累计消费</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">¥{(selectedTenant.monthlyBill / 100).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">本月消费</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-chart-3">¥{(mockBills.filter(b => b.status === 'unpaid').reduce((acc, b) => acc + b.amount, 0) / 100).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">待支付</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">¥0</div>
              <div className="text-sm text-muted-foreground mt-1">逾期金额</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select defaultValue="all">
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="paid">已支付</SelectItem>
              <SelectItem value="unpaid">未支付</SelectItem>
              <SelectItem value="overdue">已逾期</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-40 bg-card border-border">
              <SelectValue placeholder="时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="3m">近 3 个月</SelectItem>
              <SelectItem value="6m">近 6 个月</SelectItem>
              <SelectItem value="1y">近 1 年</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Bills Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">账单编号</TableHead>
                  <TableHead className="text-muted-foreground">账单周期</TableHead>
                  <TableHead className="text-muted-foreground">账单金额</TableHead>
                  <TableHead className="text-muted-foreground">Token 消耗</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">创建时间</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockBills.map((bill) => (
                  <TableRow key={bill.id} className="border-border">
                    <TableCell className="font-mono text-sm text-foreground">{bill.id}</TableCell>
                    <TableCell className="text-foreground">{bill.period}</TableCell>
                    <TableCell className="font-medium text-foreground">¥{(bill.amount / 100).toLocaleString()}</TableCell>
                    <TableCell className="text-foreground">{(bill.tokenUsage / 1000).toLocaleString()}K</TableCell>
                    <TableCell>
                      <Badge className={billStatusConfig[bill.status as keyof typeof billStatusConfig].className}>
                        {billStatusConfig[bill.status as keyof typeof billStatusConfig].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{bill.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            下载 PDF
                          </DropdownMenuItem>
                          {bill.status === 'unpaid' && (
                            <DropdownMenuItem>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              标记已支付
                            </DropdownMenuItem>
                          )}
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

  return null;
}
