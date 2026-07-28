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
  Users, Shield, Zap, UserCheck, Loader2, Trash2, KeyRound,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

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

// ADR-007 为角色制鉴权：权限由角色决定，故"权限设置"= 改角色。此处给出各角色的权限边界说明。
const roleDesc: Record<Member['role'], string> = {
  User:      '使用已发布的 Agent / Skill / 知识库问答，不能创建或管理资源',
  Developer: '创建与编辑 Agent、Skill、工作流、知识库，提交审核（仅限本人资源）',
  Auditor:   '审核 Agent / Skill / MCP 上架申请，查看审计日志，不参与开发',
  Admin:     '本租户全部权限：成员与角色管理、审核、租户设置与配额',
};

export function MembersView() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // 邀请成员（4.5.1）
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<Member['role']>('User');
  const [invDept, setInvDept] = useState('');
  const [invPwd, setInvPwd] = useState('');   // 4.8.18：创建人指定初始密码
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  // 编辑成员（4.8.12）
  const [editing, setEditing] = useState<Member | null>(null);
  const [edName, setEdName] = useState('');
  const [edDept, setEdDept] = useState('');
  const [edRole, setEdRole] = useState<Member['role']>('User');
  const [edBusy, setEdBusy] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);
  // 重置密码（4.8.19）
  const [resetting, setResetting] = useState<Member | null>(null);
  const [rsPwd, setRsPwd] = useState('');
  const [rsBusy, setRsBusy] = useState(false);
  const [rsErr, setRsErr] = useState<string | null>(null);
  const [rsOk, setRsOk] = useState(false);
  // 移除成员（4.8.12）
  const [removing, setRemoving] = useState<Member | null>(null);
  const [rmBusy, setRmBusy] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);

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

  function openEdit(member: Member) {
    setEditing(member);
    setEdName(member.name);
    setEdDept(member.department);
    setEdRole(member.role);
    setEdError(null);
  }

  async function handleSaveEdit() {
    if (!editing || edBusy) return;
    if (!edName.trim()) { setEdError('姓名不能为空'); return; }
    setEdBusy(true); setEdError(null);
    try {
      const payload: Record<string, string> = { name: edName.trim(), department: edDept.trim() };
      // 角色未变则不提交，避免无谓的角色改写与审计噪音
      if (edRole !== editing.role) payload.role = edRole;
      await apiFetch(`/api/members/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setTick(t => t + 1);
    } catch (e) {
      setEdError(e instanceof Error ? e.message : '保存失败');
    } finally { setEdBusy(false); }
  }

  async function handleResetPassword() {
    if (!resetting || rsBusy) return;
    setRsBusy(true); setRsErr(null);
    try {
      await apiFetch(`/api/members/${resetting.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: rsPwd }),
      });
      setRsOk(true);
    } catch (e) {
      setRsErr(e instanceof Error ? e.message : '重置失败');
    } finally { setRsBusy(false); }
  }

  async function handleRemove() {
    if (!removing || rmBusy) return;
    setRmBusy(true); setRmError(null);
    try {
      await apiFetch(`/api/members/${removing.id}`, { method: 'DELETE' });
      setRemoving(null);
      setTick(t => t + 1);
    } catch (e) {
      setRmError(e instanceof Error ? e.message : '移除失败');
    } finally { setRmBusy(false); }
  }

  async function handleInvite() {
    if (invBusy) return;
    if (!invEmail.trim() || !invName.trim()) { setInvError('邮箱和姓名不能为空'); return; }
    if (!invPwd) { setInvError('请设置初始密码'); return; }
    setInvBusy(true); setInvError(null);
    try {
      await apiFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify({
          email: invEmail.trim(), name: invName.trim(), role: invRole,
          department: invDept.trim() || undefined, password: invPwd,
        }),
      });
      setInviteOpen(false);
      setInvEmail(''); setInvName(''); setInvRole('User'); setInvDept(''); setInvPwd('');
      setTick(t => t + 1);
    } catch (e) {
      setInvError(e instanceof Error ? e.message : '邀请失败');
    } finally { setInvBusy(false); }
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
          {/* 4.8.13 尚未实现：明确标注即将上线，不留无提示的死按钮 */}
          <Button
            variant="outline"
            className="gap-2"
            disabled
            title="批量导入（Excel 模板）将在后续版本提供，当前请用「添加成员」逐个邀请"
          >
            <Upload className="h-4 w-4" />
            批量导入（即将上线）
          </Button>
          <Button className="gap-2 shadow-sm" onClick={() => { setInvError(null); setInviteOpen(true); }}>
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
                          {/* 4.8.12：ADR-007 为角色制，"权限设置"即改角色，已并入编辑对话框，不再单列死菜单 */}
                          <DropdownMenuItem onClick={() => openEdit(member)}>
                            <Settings className="h-4 w-4 mr-2" />
                            编辑成员
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
                          {/* 4.8.19：成员忘记密码时由管理员重置（自己改密走设置页，需验原密码）*/}
                          <DropdownMenuItem onClick={() => {
                            setRsErr(null); setRsOk(false); setRsPwd(''); setResetting(member);
                          }}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            重置密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { setRmError(null); setRemoving(member); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            移除成员
                          </DropdownMenuItem>
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

      {/* 编辑成员对话框（4.8.12）：姓名/部门/角色三合一，角色即权限（ADR-007）*/}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-name">姓名</Label>
              <Input id="ed-name" value={edName} onChange={e => setEdName(e.target.value)} placeholder="成员姓名" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-dept">部门</Label>
              <Input id="ed-dept" value={edDept} onChange={e => setEdDept(e.target.value)} placeholder="所属部门" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-role">角色（决定该成员的权限）</Label>
              <select
                id="ed-role"
                value={edRole}
                onChange={e => setEdRole(e.target.value as Member['role'])}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              >
                {(Object.keys(roleConfig) as Member['role'][]).map(r => (
                  <option key={r} value={r}>{roleConfig[r].label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-0.5">
                <Shield className="h-3.5 w-3.5 mt-px shrink-0" />
                {roleDesc[edRole]}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">邮箱 {editing?.email} 不可修改</p>
            {edError && <p className="text-xs text-destructive">{edError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={edBusy}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={edBusy}>
              {edBusy ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码（4.8.19）：管理员为忘记密码的成员设新密码 */}
      <Dialog open={resetting !== null} onOpenChange={(o) => { if (!o) setResetting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置 {resetting?.name} 的密码</DialogTitle>
          </DialogHeader>
          {rsOk ? (
            <div className="space-y-2">
              <p className="text-sm text-green-500">密码已重置</p>
              <p className="text-xs text-muted-foreground">
                请把新密码转告 {resetting?.name}（{resetting?.email}）。
                对方登录后可在「设置 → 修改密码」自行更改。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rs-pwd">新密码</Label>
                <Input id="rs-pwd" type="password" value={rsPwd} onChange={e => setRsPwd(e.target.value)}
                       placeholder="至少 8 位，含字母/数字/符号中至少两类" />
              </div>
              <p className="text-xs text-muted-foreground">
                重置后原密码立即失效。该操作会记入审计日志（不含密码内容）。
              </p>
              {rsErr && <p className="text-xs text-destructive">{rsErr}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)} disabled={rsBusy}>
              {rsOk ? '关闭' : '取消'}
            </Button>
            {!rsOk && (
              <Button onClick={handleResetPassword} disabled={rsBusy}>
                {rsBusy ? '重置中…' : '确认重置'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移除成员确认（4.8.12）：软删 + 撤角色 + 封禁登录，服务端另有"最后一名管理员"护栏 */}
      <AlertDialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除成员 {removing?.name}？</AlertDialogTitle>
            <AlertDialogDescription>
              移除后该成员将无法登录，其角色权限一并回收。历史数据保留，可联系管理员恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rmError && <p className="text-xs text-destructive">{rmError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rmBusy}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRemove(); }}
              disabled={rmBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rmBusy ? '移除中…' : '确认移除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 邀请成员对话框（4.5.1）*/}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">邮箱</Label>
              <Input id="inv-email" type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">姓名</Label>
              <Input id="inv-name" value={invName} onChange={e => setInvName(e.target.value)} placeholder="成员姓名" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">角色</Label>
                <select
                  id="inv-role"
                  value={invRole}
                  onChange={e => setInvRole(e.target.value as Member['role'])}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  {(Object.keys(roleConfig) as Member['role'][]).map(r => (
                    <option key={r} value={r}>{roleConfig[r].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-dept">部门</Label>
                <Input id="inv-dept" value={invDept} onChange={e => setInvDept(e.target.value)} placeholder="所属部门" />
              </div>
            </div>
            {/* 4.8.18：不再发邀请邮件，创建人直接设初始密码 */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-pwd">初始密码</Label>
              <Input id="inv-pwd" type="password" value={invPwd} onChange={e => setInvPwd(e.target.value)}
                     placeholder="至少 8 位，含字母/数字/符号中至少两类" />
              <p className="text-xs text-muted-foreground">
                请把该密码转告本人。成员登录后可在「设置 → 修改密码」自行更改，不改则一直沿用。
              </p>
            </div>
            {invError && <p className="text-xs text-destructive">{invError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleInvite} disabled={invBusy}>
              {invBusy ? '创建中…' : '创建成员'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
