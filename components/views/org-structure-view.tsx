'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Users,
  Zap,
  HardDrive,
  Bot,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderPlus,
  GripVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  manager: string;
  memberCount: number;
  status: 'active' | 'frozen' | 'archived';
  tokenUsed: number;
  tokenLimit: number;
  storageUsed: number;
  storageLimit: number;
  agentCount: number;
  children?: Department[];
}

const mockDepartments: Department[] = [
  {
    id: 'dept-1',
    name: '技术研发中心',
    code: 'TECH',
    parentId: null,
    manager: '张三',
    memberCount: 128,
    status: 'active',
    tokenUsed: 2500000,
    tokenLimit: 5000000,
    storageUsed: 45,
    storageLimit: 100,
    agentCount: 15,
    children: [
      {
        id: 'dept-1-1',
        name: 'AI 研发部',
        code: 'TECH-AI',
        parentId: 'dept-1',
        manager: '李四',
        memberCount: 35,
        status: 'active',
        tokenUsed: 1200000,
        tokenLimit: 2000000,
        storageUsed: 20,
        storageLimit: 30,
        agentCount: 8,
        children: [
          {
            id: 'dept-1-1-1',
            name: 'NLP 组',
            code: 'TECH-AI-NLP',
            parentId: 'dept-1-1',
            manager: '王五',
            memberCount: 12,
            status: 'active',
            tokenUsed: 500000,
            tokenLimit: 800000,
            storageUsed: 8,
            storageLimit: 10,
            agentCount: 3,
          },
          {
            id: 'dept-1-1-2',
            name: '视觉组',
            code: 'TECH-AI-CV',
            parentId: 'dept-1-1',
            manager: '赵六',
            memberCount: 10,
            status: 'active',
            tokenUsed: 400000,
            tokenLimit: 600000,
            storageUsed: 6,
            storageLimit: 10,
            agentCount: 2,
          },
        ],
      },
      {
        id: 'dept-1-2',
        name: '后端开发部',
        code: 'TECH-BE',
        parentId: 'dept-1',
        manager: '钱七',
        memberCount: 45,
        status: 'active',
        tokenUsed: 800000,
        tokenLimit: 1500000,
        storageUsed: 15,
        storageLimit: 30,
        agentCount: 4,
      },
      {
        id: 'dept-1-3',
        name: '前端开发部',
        code: 'TECH-FE',
        parentId: 'dept-1',
        manager: '孙八',
        memberCount: 28,
        status: 'active',
        tokenUsed: 300000,
        tokenLimit: 800000,
        storageUsed: 5,
        storageLimit: 20,
        agentCount: 2,
      },
    ],
  },
  {
    id: 'dept-2',
    name: '产品运营中心',
    code: 'PROD',
    parentId: null,
    manager: '周九',
    memberCount: 56,
    status: 'active',
    tokenUsed: 800000,
    tokenLimit: 2000000,
    storageUsed: 25,
    storageLimit: 50,
    agentCount: 6,
    children: [
      {
        id: 'dept-2-1',
        name: '产品部',
        code: 'PROD-PM',
        parentId: 'dept-2',
        manager: '吴十',
        memberCount: 20,
        status: 'active',
        tokenUsed: 400000,
        tokenLimit: 800000,
        storageUsed: 10,
        storageLimit: 20,
        agentCount: 3,
      },
    ],
  },
  {
    id: 'dept-3',
    name: '市场销售中心',
    code: 'SALES',
    parentId: null,
    manager: '郑十一',
    memberCount: 42,
    status: 'active',
    tokenUsed: 600000,
    tokenLimit: 1500000,
    storageUsed: 15,
    storageLimit: 40,
    agentCount: 4,
  },
  {
    id: 'dept-4',
    name: '人力行政中心',
    code: 'HR',
    parentId: null,
    manager: '冯十二',
    memberCount: 18,
    status: 'frozen',
    tokenUsed: 150000,
    tokenLimit: 500000,
    storageUsed: 5,
    storageLimit: 20,
    agentCount: 2,
  },
];

const mockMembers = [
  { id: '1', name: '王五', avatar: '', role: '组长', email: 'wangwu@company.com', status: 'active' },
  { id: '2', name: '李明', avatar: '', role: '高级工程师', email: 'liming@company.com', status: 'active' },
  { id: '3', name: '张华', avatar: '', role: '工程师', email: 'zhanghua@company.com', status: 'active' },
  { id: '4', name: '陈晨', avatar: '', role: '工程师', email: 'chenchen@company.com', status: 'active' },
  { id: '5', name: '刘洋', avatar: '', role: '实习生', email: 'liuyang@company.com', status: 'trial' },
];

function DepartmentTree({
  departments,
  selectedId,
  onSelect,
  level = 0,
}: {
  departments: Department[];
  selectedId: string | null;
  onSelect: (dept: Department) => void;
  level?: number;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['dept-1', 'dept-1-1', 'dept-2']));

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div className="space-y-0.5">
      {departments.map((dept) => {
        const hasChildren = dept.children && dept.children.length > 0;
        const isExpanded = expandedIds.has(dept.id);
        const isSelected = selectedId === dept.id;

        return (
          <div key={dept.id}>
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
                isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => onSelect(dept)}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(dept.id);
                  }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4.5" />
              )}
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">{dept.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  dept.status === 'active'
                    ? 'border-green-500/30 text-green-500'
                    : dept.status === 'frozen'
                      ? 'border-yellow-500/30 text-yellow-500'
                      : 'border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {dept.memberCount}
              </Badge>
            </div>
            {hasChildren && isExpanded && (
              <DepartmentTree
                departments={dept.children!}
                selectedId={selectedId}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OrgStructureView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<Department | null>(mockDepartments[0].children?.[0].children?.[0] || null);

  return (
    <div className="flex h-full gap-6">
      {/* 左侧：部门树 */}
      <Card className="w-72 flex-shrink-0 flex flex-col bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">组织架构</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索部门..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-sm bg-muted/50 border-0"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full px-2 pb-2">
            <DepartmentTree
              departments={mockDepartments}
              selectedId={selectedDept?.id || null}
              onSelect={setSelectedDept}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：部门详情 */}
      {selectedDept && (
        <div className="flex-1 space-y-5 overflow-auto">
          {/* 部门信息卡片 */}
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{selectedDept.name}</h2>
                      <Badge
                        className={
                          selectedDept.status === 'active'
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : selectedDept.status === 'frozen'
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              : 'bg-muted text-muted-foreground'
                        }
                      >
                        {selectedDept.status === 'active' ? '正常' : selectedDept.status === 'frozen' ? '冻结' : '已撤销'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      部门编码：{selectedDept.code} · 负责人：{selectedDept.manager}
                    </p>
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
                      编辑部门
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FolderPlus className="h-4 w-4 mr-2" />
                      添加子部门
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除部门
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {/* 资源配额统计 */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Token 用量</p>
                    <p className="text-lg font-semibold text-foreground">
                      {(selectedDept.tokenUsed / 10000).toFixed(1)}万
                    </p>
                    <Progress
                      value={(selectedDept.tokenUsed / selectedDept.tokenLimit) * 100}
                      className="h-1 mt-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      限额 {(selectedDept.tokenLimit / 10000).toFixed(0)}万
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <HardDrive className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">存储空间</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDept.storageUsed} GB</p>
                    <Progress
                      value={(selectedDept.storageUsed / selectedDept.storageLimit) * 100}
                      className="h-1 mt-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      限额 {selectedDept.storageLimit} GB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Agent 数量</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDept.agentCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-2.5">限额 10 个</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">成员数量</p>
                    <p className="text-lg font-semibold text-foreground">{selectedDept.memberCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-2.5">限额 50 人</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 部门成员列表 */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">部门成员</CardTitle>
                <Button size="sm" className="h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  添加成员
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {mockMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {member.name.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{member.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge
                      className={
                        member.status === 'active'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }
                    >
                      {member.status === 'active' ? '在职' : '试用'}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
