'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Users,
  Plus,
  Search,
  Crown,
  Settings,
  Bot,
  Lock,
  DollarSign,
  Building2,
  Code,
  User,
  Edit,
  Copy,
  Trash2,
  MoreHorizontal,
  Check,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  bgColor: string;
  userCount: number;
  dataScope: 'all' | 'dept_and_children' | 'dept' | 'self';
  isSystem: boolean;
  permissions: Record<string, string[]>;
}

const mockRoles: Role[] = [
  {
    id: 'role-1',
    name: '企业超级管理员',
    description: '拥有企业所有功能的完整权限',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    userCount: 2,
    dataScope: 'all',
    isSystem: true,
    permissions: {
      dashboard: ['view', 'export'],
      agent: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      skill: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      knowledge: ['view', 'create', 'edit', 'delete', 'export'],
      workflow: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      security: ['view', 'approve', 'export'],
      member: ['view', 'create', 'edit', 'delete', 'export'],
      settings: ['view', 'edit'],
    },
  },
  {
    id: 'role-2',
    name: '企业管理员',
    description: '管理组织、人员和资源配额',
    icon: Settings,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    userCount: 5,
    dataScope: 'all',
    isSystem: true,
    permissions: {
      dashboard: ['view', 'export'],
      agent: ['view', 'export'],
      skill: ['view', 'export'],
      knowledge: ['view', 'export'],
      workflow: ['view', 'export'],
      security: ['view'],
      member: ['view', 'create', 'edit', 'delete', 'export'],
      settings: ['view', 'edit'],
    },
  },
  {
    id: 'role-3',
    name: 'AI 管理员',
    description: '管理 Agent、Skill 和模型配置',
    icon: Bot,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    userCount: 8,
    dataScope: 'all',
    isSystem: true,
    permissions: {
      dashboard: ['view', 'export'],
      agent: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      skill: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      knowledge: ['view', 'create', 'edit', 'delete', 'export'],
      workflow: ['view', 'create', 'edit', 'delete', 'publish', 'export'],
      security: ['view', 'approve'],
      member: ['view'],
      settings: ['view'],
    },
  },
  {
    id: 'role-4',
    name: '安全管理员',
    description: '审计、权限和 MCP 审批管理',
    icon: Lock,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    userCount: 3,
    dataScope: 'all',
    isSystem: true,
    permissions: {
      dashboard: ['view'],
      agent: ['view'],
      skill: ['view'],
      knowledge: ['view'],
      workflow: ['view'],
      security: ['view', 'approve', 'export'],
      member: ['view'],
      settings: ['view'],
    },
  },
  {
    id: 'role-5',
    name: '财务管理员',
    description: '账单、配额和成本分析',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    userCount: 2,
    dataScope: 'all',
    isSystem: true,
    permissions: {
      dashboard: ['view', 'export'],
      agent: ['view'],
      skill: ['view'],
      knowledge: ['view'],
      workflow: ['view'],
      security: ['view'],
      member: ['view'],
      settings: ['view'],
    },
  },
  {
    id: 'role-6',
    name: '部门管理员',
    description: '本部门人员和资源管理',
    icon: Building2,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    userCount: 12,
    dataScope: 'dept_and_children',
    isSystem: true,
    permissions: {
      dashboard: ['view'],
      agent: ['view', 'create', 'edit'],
      skill: ['view'],
      knowledge: ['view', 'create', 'edit'],
      workflow: ['view', 'create', 'edit'],
      security: ['view'],
      member: ['view', 'edit'],
      settings: ['view'],
    },
  },
  {
    id: 'role-7',
    name: '开发者',
    description: '创建和管理 Agent/Skill',
    icon: Code,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    userCount: 45,
    dataScope: 'dept',
    isSystem: true,
    permissions: {
      dashboard: ['view'],
      agent: ['view', 'create', 'edit'],
      skill: ['view', 'create', 'edit'],
      knowledge: ['view', 'create', 'edit'],
      workflow: ['view', 'create', 'edit'],
      security: [],
      member: [],
      settings: [],
    },
  },
  {
    id: 'role-8',
    name: '普通用户',
    description: '使用 Agent/Skill 服务',
    icon: User,
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    userCount: 180,
    dataScope: 'self',
    isSystem: true,
    permissions: {
      dashboard: ['view'],
      agent: ['view'],
      skill: ['view'],
      knowledge: ['view'],
      workflow: ['view'],
      security: [],
      member: [],
      settings: [],
    },
  },
];

const modules = [
  { id: 'dashboard', name: '监控面板' },
  { id: 'agent', name: 'Agent 管理' },
  { id: 'skill', name: 'Skill Hub' },
  { id: 'knowledge', name: '知识库' },
  { id: 'workflow', name: '工作流' },
  { id: 'security', name: '安全审核' },
  { id: 'member', name: '成员管理' },
  { id: 'settings', name: '系统设置' },
];

const operations = [
  { id: 'view', name: '查看' },
  { id: 'create', name: '创建' },
  { id: 'edit', name: '编辑' },
  { id: 'delete', name: '删除' },
  { id: 'publish', name: '发布' },
  { id: 'approve', name: '审批' },
  { id: 'export', name: '导出' },
];

const dataScopeOptions = [
  { value: 'all', label: '全部数据' },
  { value: 'dept_and_children', label: '本部门及下级' },
  { value: 'dept', label: '仅本部门' },
  { value: 'self', label: '仅本人' },
];

export function RolesPermissionsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(mockRoles[0]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const filteredRoles = mockRoles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">角色权限管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">配置角色和功能权限矩阵</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              创建角色
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>创建自定义角色</DialogTitle>
              <DialogDescription>创建新角色并配置权限</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>角色名称</Label>
                <Input placeholder="输入角色名称" />
              </div>
              <div className="space-y-2">
                <Label>角色描述</Label>
                <Textarea placeholder="描述此角色的职责范围" className="h-20" />
              </div>
              <div className="space-y-2">
                <Label>数据权限</Label>
                <Select defaultValue="dept">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataScopeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>继承角色</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="选择基础角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setCreateDialogOpen(false)}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-6">
        {/* 左侧：角色列表 */}
        <div className="w-80 flex-shrink-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索角色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2 pr-2">
              {filteredRoles.map((role) => (
                <Card
                  key={role.id}
                  className={`cursor-pointer transition-all ${
                    selectedRole.id === role.id
                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRole(role)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg ${role.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <role.icon className={`h-5 w-5 ${role.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{role.name}</h3>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              系统
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {role.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {role.userCount} 用户
                          </span>
                          <span>
                            {dataScopeOptions.find((d) => d.value === role.dataScope)?.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* 右侧：权限矩阵 */}
        <Card className="flex-1 bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${selectedRole.bgColor} flex items-center justify-center`}>
                  <selectedRole.icon className={`h-6 w-6 ${selectedRole.color}`} />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedRole.name}
                    {selectedRole.isSystem && (
                      <Badge variant="outline" className="text-xs">系统角色</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{selectedRole.description}</CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    编辑角色
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="h-4 w-4 mr-2" />
                    复制角色
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" disabled={selectedRole.isSystem}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除角色
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedRole.userCount}</span> 用户
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  数据范围：
                  <span className="font-medium text-foreground">
                    {dataScopeOptions.find((d) => d.value === selectedRole.dataScope)?.label}
                  </span>
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-420px)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <tr>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 w-40">
                        功能模块
                      </th>
                      {operations.map((op) => (
                        <th
                          key={op.id}
                          className="text-center text-xs font-medium text-muted-foreground p-3 w-16"
                        >
                          {op.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module, idx) => (
                      <tr
                        key={module.id}
                        className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                      >
                        <td className="p-3 text-sm font-medium text-foreground">{module.name}</td>
                        {operations.map((op) => {
                          const hasPermission = selectedRole.permissions[module.id]?.includes(op.id);
                          return (
                            <td key={op.id} className="p-3 text-center">
                              <div className="flex justify-center">
                                {hasPermission ? (
                                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                    <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
