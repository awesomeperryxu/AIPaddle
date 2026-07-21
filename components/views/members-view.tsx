'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Member } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Upload, Settings, MoreHorizontal,
  Users, Shield, Zap, UserCheck, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 显示标签对齐原型（员工/AI 工程师/安全人员/管理员）；后端角色键保持 ADR-007 体系不变
const roleConfig: Record<Member['role'], { label: string; className: string }> = {
  User:      { label: '员工',      className: 'bg-muted text-muted-foreground' },
  Developer: { label: 'AI 工程师', className: 'bg-blue-500/10 text-blue-500' },
  Auditor:   { label: '安全人员',  className: 'bg-orange-500/10 text-orange-500' },
  Admin:     { label: '管理员',    className: 'bg-primary/10 text-primary' },
};

const statusConfig: Record<'active' | 'disabled', { label: string; className: string }> = {
  active:   { label: '正常',   className: 'bg-green-500/10 text-green-500' },
  disabled: { label: '已禁用', className: 'bg-destructive/10 text-destructive' },
};

export function MembersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false
    apiFetch<{ members: Member[] }>('/api/members')
      .then(data => { if (!cancelled) setMembers(data.members) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tick])

  const handleSetStatus = async (member: Member, newStatus: 'active' | 'inactive') => {
    setActionLoading(member.id)
    try {
      await apiFetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setTick(t => t + 1)
    } catch {
      // 失败时静默，刷新恢复
    } finally {
      setActionLoading(null)
    }
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 部门列表从真实数据推导
  const departments = [...new Set(members.map(m => m.department).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">成员管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理组织成员和权限</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" disabled>
            <Upload className="h-4 w-4" />
            批量导入
          </Button>
          <Button className="gap-2 shadow-sm" disabled>
            <Plus className="h-4 w-4" />
            添加成员
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{members.length}</p>
                <p className="text-xs text-muted-foreground">总成员数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{members.filter(m => m.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">活跃成员</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{members.filter(m => m.role === 'Developer').length}</p>
                <p className="text-xs text-muted-foreground">AI 工程师</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{members.filter(m => m.role === 'Admin' || m.role === 'Auditor').length}</p>
                <p className="text-xs text-muted-foreground">管理角色</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索成员..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {/* Members Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">成员</TableHead>
                  <TableHead className="text-muted-foreground">部门</TableHead>
                  <TableHead className="text-muted-foreground">角色</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">最后登录</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      {searchTerm ? '未找到匹配成员' : '暂无成员'}
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.map((member) => (
                  <TableRow key={member.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-medium text-foreground">
                          {member.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{member.department}</TableCell>
                    <TableCell>
                      <Badge className={roleConfig[member.role].className}>
                        {roleConfig[member.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[member.status].className}>
                        {statusConfig[member.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.lastLogin}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            disabled={actionLoading === member.id}
                          >
                            {actionLoading === member.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem disabled>
                            <Settings className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Shield className="h-4 w-4 mr-2" />
                            权限设置
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {member.status === 'active' ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleSetStatus(member, 'inactive')}
                            >
                              禁用账号
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-green-500"
                              onClick={() => handleSetStatus(member, 'active')}
                            >
                              启用账号
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Organization Structure */}
      {departments.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">组织结构</CardTitle>
            <CardDescription>按部门查看成员分布</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {departments.map((dept) => {
                const deptMembers = members.filter(m => m.department === dept)
                return (
                  <div key={dept} className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{dept}</span>
                      <Badge variant="outline">{deptMembers.length} 人</Badge>
                    </div>
                    <div className="flex -space-x-2">
                      {deptMembers.slice(0, 4).map((m) => (
                        <div
                          key={m.id}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-medium text-foreground border-2 border-card"
                        >
                          {m.name[0]}
                        </div>
                      ))}
                      {deptMembers.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border-2 border-card">
                          +{deptMembers.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
