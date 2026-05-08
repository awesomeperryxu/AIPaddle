'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  Shield,
  Settings,
  Bot,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userId: string;
  eventType: string;
  eventCategory: 'auth' | 'user' | 'permission' | 'resource' | 'security' | 'system';
  target: string;
  targetType: string;
  ip: string;
  location: string;
  userAgent: string;
  result: 'success' | 'failure' | 'warning';
  details: Record<string, unknown>;
}

const mockLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: '2026-05-08 16:45:23',
    user: '张三',
    userId: 'EMP001',
    eventType: '用户登录',
    eventCategory: 'auth',
    target: '系统',
    targetType: 'system',
    ip: '192.168.1.100',
    location: '上海',
    userAgent: 'Chrome 125.0 / Windows 11',
    result: 'success',
    details: { loginMethod: 'SSO', mfaUsed: true },
  },
  {
    id: '2',
    timestamp: '2026-05-08 16:30:15',
    user: '李四',
    userId: 'EMP002',
    eventType: '创建 Agent',
    eventCategory: 'resource',
    target: '智能客服 Agent v2',
    targetType: 'agent',
    ip: '10.0.0.52',
    location: '北京',
    userAgent: 'Safari 17.4 / macOS',
    result: 'success',
    details: { agentId: 'agent-123', department: 'AI研发部' },
  },
  {
    id: '3',
    timestamp: '2026-05-08 16:15:42',
    user: '王五',
    userId: 'EMP003',
    eventType: '角色变更',
    eventCategory: 'permission',
    target: '赵六',
    targetType: 'user',
    ip: '172.16.0.88',
    location: '深圳',
    userAgent: 'Firefox 126.0 / Linux',
    result: 'success',
    details: { oldRole: '普通用户', newRole: '开发者' },
  },
  {
    id: '4',
    timestamp: '2026-05-08 15:58:31',
    user: 'System',
    userId: 'SYSTEM',
    eventType: 'MCP 审批拒绝',
    eventCategory: 'security',
    target: 'External API MCP',
    targetType: 'mcp',
    ip: '-',
    location: '-',
    userAgent: 'System',
    result: 'warning',
    details: { reason: '权限范围过大', riskLevel: 'high' },
  },
  {
    id: '5',
    timestamp: '2026-05-08 15:45:18',
    user: '钱七',
    userId: 'EMP005',
    eventType: '登录失败',
    eventCategory: 'auth',
    target: '系统',
    targetType: 'system',
    ip: '192.168.2.200',
    location: '广州',
    userAgent: 'Edge 125.0 / Windows 10',
    result: 'failure',
    details: { reason: '密码错误', attemptCount: 3 },
  },
  {
    id: '6',
    timestamp: '2026-05-08 15:30:05',
    user: '孙八',
    userId: 'EMP006',
    eventType: '删除知识库',
    eventCategory: 'resource',
    target: '旧版产品文档',
    targetType: 'knowledge',
    ip: '10.1.1.33',
    location: '杭州',
    userAgent: 'Chrome 125.0 / Android',
    result: 'success',
    details: { documentCount: 156, storageFreed: '2.5GB' },
  },
  {
    id: '7',
    timestamp: '2026-05-08 15:15:22',
    user: '周九',
    userId: 'EMP007',
    eventType: '配额调整',
    eventCategory: 'system',
    target: 'AI研发部',
    targetType: 'department',
    ip: '192.168.1.55',
    location: '上海',
    userAgent: 'Chrome 125.0 / Windows 11',
    result: 'success',
    details: { oldTokenLimit: 2000000, newTokenLimit: 3000000 },
  },
  {
    id: '8',
    timestamp: '2026-05-08 14:58:44',
    user: '吴十',
    userId: 'EMP008',
    eventType: '用户创建',
    eventCategory: 'user',
    target: '新员工-刘洋',
    targetType: 'user',
    ip: '172.16.0.100',
    location: '北京',
    userAgent: 'Safari 17.4 / macOS',
    result: 'success',
    details: { department: 'NLP组', role: '实习生' },
  },
];

const eventCategories = [
  { value: 'all', label: '全部类型' },
  { value: 'auth', label: '登录认证' },
  { value: 'user', label: '用户管理' },
  { value: 'permission', label: '权限变更' },
  { value: 'resource', label: '资源操作' },
  { value: 'security', label: '安全事件' },
  { value: 'system', label: '系统配置' },
];

const resultOptions = [
  { value: 'all', label: '全部结果' },
  { value: 'success', label: '成功' },
  { value: 'failure', label: '失败' },
  { value: 'warning', label: '警告' },
];

const getCategoryIcon = (category: string) => {
  const icons: Record<string, typeof LogIn> = {
    auth: LogIn,
    user: UserPlus,
    permission: Shield,
    resource: Bot,
    security: AlertTriangle,
    system: Settings,
  };
  return icons[category] || FileText;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    auth: 'text-blue-500 bg-blue-500/10',
    user: 'text-green-500 bg-green-500/10',
    permission: 'text-purple-500 bg-purple-500/10',
    resource: 'text-cyan-500 bg-cyan-500/10',
    security: 'text-red-500 bg-red-500/10',
    system: 'text-orange-500 bg-orange-500/10',
  };
  return colors[category] || 'text-muted-foreground bg-muted';
};

const statsData = [
  { label: '今日事件', value: 1256, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { label: '成功操作', value: 1198, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  { label: '失败操作', value: 42, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  { label: '安全告警', value: 16, icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
];

export function AuditLogView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || log.eventCategory === categoryFilter;
    const matchesResult = resultFilter === 'all' || log.result === resultFilter;
    return matchesSearch && matchesCategory && matchesResult;
  });

  const getResultBadge = (result: string) => {
    const config: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
      success: {
        label: '成功',
        className: 'bg-green-500/10 text-green-500 border-green-500/20',
        icon: CheckCircle,
      },
      failure: {
        label: '失败',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
        icon: XCircle,
      },
      warning: {
        label: '警告',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        icon: AlertTriangle,
      },
    };
    const { label, className, icon: Icon } = config[result];
    return (
      <Badge className={`${className} gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">审计日志</h1>
          <p className="text-sm text-muted-foreground mt-0.5">查看和导出系统操作审计记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            导出
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 搜索和筛选 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索操作人、事件类型、操作对象..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eventCategories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resultOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calendar className="h-4 w-4" />
          时间范围
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" />
          更多筛选
        </Button>
      </div>

      {/* 日志列表 */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>事件类型</TableHead>
                <TableHead>操作对象</TableHead>
                <TableHead>IP 地址</TableHead>
                <TableHead>位置</TableHead>
                <TableHead>结果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const Icon = getCategoryIcon(log.eventCategory);
                const colorClass = getCategoryColor(log.eventCategory);
                const isExpanded = expandedIds.has(log.id);

                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpand(log.id)}>
                    <TableRow className="cursor-pointer" onClick={() => toggleExpand(log.id)}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {log.timestamp}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-foreground">{log.user}</span>
                          {log.userId !== 'SYSTEM' && (
                            <span className="text-xs text-muted-foreground ml-1">({log.userId})</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-md ${colorClass.split(' ')[1]} flex items-center justify-center`}>
                            <Icon className={`h-4 w-4 ${colorClass.split(' ')[0]}`} />
                          </div>
                          <span className="text-sm">{log.eventType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm text-foreground">{log.target}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                            {log.targetType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{log.ip}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{log.location}</TableCell>
                      <TableCell>{getResultBadge(log.result)}</TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={8} className="py-3">
                          <div className="pl-10 space-y-2">
                            <div className="grid grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">设备信息：</span>
                                <span className="text-foreground ml-1">{log.userAgent}</span>
                              </div>
                              <div className="col-span-3">
                                <span className="text-muted-foreground">详细信息：</span>
                                <span className="text-foreground ml-1 font-mono text-xs">
                                  {JSON.stringify(log.details)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
