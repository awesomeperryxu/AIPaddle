'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Plus,
  Search,
  Download,
  Upload,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Shield,
  Activity,
  Calendar,
  Edit,
  Trash2,
  Key,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  status: 'active' | 'trial' | 'inactive' | 'frozen';
  lastLogin: string;
  joinedAt: string;
  avatar?: string;
  tokenUsed: number;
  agentCalls: number;
}

const mockUsers: User[] = [
  {
    id: '1',
    employeeId: 'EMP001',
    name: '张三',
    email: 'zhangsan@company.com',
    phone: '138****1234',
    department: 'AI 研发部',
    position: '部门经理',
    role: '企业管理员',
    status: 'active',
    lastLogin: '2026-05-08 14:30',
    joinedAt: '2024-01-15',
    tokenUsed: 125000,
    agentCalls: 1256,
  },
  {
    id: '2',
    employeeId: 'EMP002',
    name: '李四',
    email: 'lisi@company.com',
    phone: '139****5678',
    department: 'NLP 组',
    position: '高级工程师',
    role: 'AI 管理员',
    status: 'active',
    lastLogin: '2026-05-08 12:15',
    joinedAt: '2024-03-20',
    tokenUsed: 89000,
    agentCalls: 892,
  },
  {
    id: '3',
    employeeId: 'EMP003',
    name: '王五',
    email: 'wangwu@company.com',
    phone: '136****9012',
    department: '视觉组',
    position: '组长',
    role: '开发者',
    status: 'active',
    lastLogin: '2026-05-08 10:45',
    joinedAt: '2024-05-10',
    tokenUsed: 67000,
    agentCalls: 645,
  },
  {
    id: '4',
    employeeId: 'EMP004',
    name: '赵六',
    email: 'zhaoliu@company.com',
    phone: '135****3456',
    department: '后端开发部',
    position: '工程师',
    role: '普通用户',
    status: 'trial',
    lastLogin: '2026-05-07 16:20',
    joinedAt: '2026-04-01',
    tokenUsed: 12000,
    agentCalls: 156,
  },
  {
    id: '5',
    employeeId: 'EMP005',
    name: '钱七',
    email: 'qianqi@company.com',
    phone: '137****7890',
    department: '产品部',
    position: '产品经理',
    role: '普通用户',
    status: 'active',
    lastLogin: '2026-05-08 09:30',
    joinedAt: '2024-08-15',
    tokenUsed: 45000,
    agentCalls: 423,
  },
  {
    id: '6',
    employeeId: 'EMP006',
    name: '孙八',
    email: 'sunba@company.com',
    phone: '133****2345',
    department: '市场销售中心',
    position: '销售总监',
    role: '部门管理员',
    status: 'frozen',
    lastLogin: '2026-04-15 11:00',
    joinedAt: '2024-02-01',
    tokenUsed: 28000,
    agentCalls: 312,
  },
  {
    id: '7',
    employeeId: 'EMP007',
    name: '周九',
    email: 'zhoujiu@company.com',
    phone: '131****6789',
    department: '人力行政中心',
    position: 'HR 专员',
    role: '普通用户',
    status: 'inactive',
    lastLogin: '2026-03-20 14:00',
    joinedAt: '2024-06-01',
    tokenUsed: 8000,
    agentCalls: 89,
  },
];

const statsData = [
  { label: '总用户数', value: 256, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', change: '+12', changeType: 'up' },
  { label: '在职员工', value: 228, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10', change: '+8', changeType: 'up' },
  { label: '今日活跃', value: 186, icon: Activity, color: 'text-cyan-500', bg: 'bg-cyan-500/10', change: '72.6%', changeType: 'neutral' },
  { label: '待审批', value: 5, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', change: '-2', changeType: 'down' },
];

export function UsersManagementView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id));
    }
  };

  const openUserDetail = (user: User) => {
    setSelectedUser(user);
    setSheetOpen(true);
  };

  const getStatusBadge = (status: User['status']) => {
    const config = {
      active: { label: '正常', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      trial: { label: '试用', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      inactive: { label: '离职', className: 'bg-muted text-muted-foreground' },
      frozen: { label: '冻结', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    };
    return <Badge className={config[status].className}>{config[status].label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, string> = {
      '企业管理员': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'AI 管理员': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      '安全管理员': 'bg-red-500/10 text-red-500 border-red-500/20',
      '部门管理员': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      '开发者': 'bg-green-500/10 text-green-500 border-green-500/20',
      '普通用户': 'bg-muted text-muted-foreground',
    };
    return <Badge variant="outline" className={config[role] || 'bg-muted text-muted-foreground'}>{role}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">人员管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理企业用户、角色分配和权限配置</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            批量导入
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            导出
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            添加用户
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold text-foreground mt-1">{stat.value}</p>
                  <p className={`text-xs mt-1.5 ${
                    stat.changeType === 'up' ? 'text-green-500' : 
                    stat.changeType === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {stat.change} 本月
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
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
            placeholder="搜索用户名、邮箱、部门..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border h-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="部门" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部部门</SelectItem>
            <SelectItem value="tech">技术研发中心</SelectItem>
            <SelectItem value="product">产品运营中心</SelectItem>
            <SelectItem value="sales">市场销售中心</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部角色</SelectItem>
            <SelectItem value="admin">企业管理员</SelectItem>
            <SelectItem value="ai-admin">AI 管理员</SelectItem>
            <SelectItem value="developer">开发者</SelectItem>
            <SelectItem value="user">普通用户</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-28 h-9">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">正常</SelectItem>
            <SelectItem value="trial">试用</SelectItem>
            <SelectItem value="frozen">冻结</SelectItem>
            <SelectItem value="inactive">离职</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 批量操作栏 */}
      {selectedUsers.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-5 flex items-center justify-between">
            <span className="text-sm text-foreground">
              已选择 <span className="font-medium">{selectedUsers.length}</span> 个用户
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">批量分配角色</Button>
              <Button variant="outline" size="sm">批量调整部门</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                批量禁用
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 用户列表 */}
      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onCheckedChange={toggleAllSelection}
                />
              </TableHead>
              <TableHead>用户信息</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="cursor-pointer" onClick={() => openUserDetail(user)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {user.name.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.employeeId}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm text-foreground">{user.department}</p>
                    <p className="text-xs text-muted-foreground">{user.position}</p>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.lastLogin}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openUserDetail(user)}>
                        <Edit className="h-4 w-4 mr-2" />
                        编辑用户
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Key className="h-4 w-4 mr-2" />
                        重置密码
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除用户
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* 用户详情抽屉 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          {selectedUser && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {selectedUser.name.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="flex items-center gap-2">
                      {selectedUser.name}
                      {getStatusBadge(selectedUser.status)}
                    </SheetTitle>
                    <SheetDescription>{selectedUser.position}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="info" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1">基本信息</TabsTrigger>
                  <TabsTrigger value="permission" className="flex-1">角色权限</TabsTrigger>
                  <TabsTrigger value="usage" className="flex-1">使用统计</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">工号</p>
                      <p className="text-sm font-medium">{selectedUser.employeeId}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">部门</p>
                      <p className="text-sm font-medium">{selectedUser.department}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> 邮箱
                      </p>
                      <p className="text-sm font-medium">{selectedUser.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> 手机
                      </p>
                      <p className="text-sm font-medium">{selectedUser.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> 职位
                      </p>
                      <p className="text-sm font-medium">{selectedUser.position}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> 入职日期
                      </p>
                      <p className="text-sm font-medium">{selectedUser.joinedAt}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="permission" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{selectedUser.role}</p>
                          <p className="text-xs text-muted-foreground">当前角色</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">变更角色</Button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">权限列表</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['查看 Agent', '创建 Agent', '使用 Skill', '访问知识库', '查看统计', '导出数据'].map((perm) => (
                          <div key={perm} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {perm}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="usage" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-muted/50 border-0">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Token 消耗</p>
                        <p className="text-xl font-semibold mt-1">{(selectedUser.tokenUsed / 1000).toFixed(1)}K</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-0">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Agent 调用</p>
                        <p className="text-xl font-semibold mt-1">{selectedUser.agentCalls}</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 mt-6">
                <Button className="flex-1">保存修改</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>取消</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
