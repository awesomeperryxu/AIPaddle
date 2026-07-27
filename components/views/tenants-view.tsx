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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

interface Tenant {
  id: string;
  name: string;
  adminEmail: string;
  status: 'active' | 'suspended' | 'overdue';
  members: number;
  agents: number;
  tokenUsage: number;
  tokenQuota: number;
  monthlyBill: number;
  createdAt: string;
}

const statusConfig = {
  active: { label: '正常', className: 'bg-green-500/10 text-green-500' },
  suspended: { label: '已暂停', className: 'bg-destructive/10 text-destructive' },
  overdue: { label: '欠费', className: 'bg-yellow-500/10 text-yellow-500' }
};

// 平台真实租户（ADR-010）。ADR-017：取消套餐分级，不再携带/展示 planType。
type PlatformTenant = {
  id: string; name: string; code: string;
  tokenQuota: number; qpsLimit: number; status: 'active' | 'suspended'; contactName: string; contactEmail: string; createdAt: string;
};

export function TenantsView({
  tenants = [],
  canManage = false,
}: {
  tenants?: PlatformTenant[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [busy, setBusy] = useState(false);
  // 开通企业表单
  const [provOpen, setProvOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pContact, setPContact] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pQuota, setPQuota] = useState('1000000');
  const [pErr, setPErr] = useState<string | null>(null);

  // 真实租户映射到表格展示 shape（用量/账单等分析字段暂缺，置 0）
  const displayTenants: Tenant[] = tenants.map((t) => ({
    id: t.id, name: t.name, adminEmail: t.contactEmail || t.code,
    status: t.status,
    members: 0, agents: 0, tokenUsage: 0, tokenQuota: t.tokenQuota, monthlyBill: 0,
    createdAt: t.createdAt,
  }));

  const filteredTenants = displayTenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleProvision() {
    if (busy) return;
    setPErr(null); setBusy(true);
    try {
      await apiFetch('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: pName.trim(), code: pCode.trim(), contactName: pContact.trim(),
          contactEmail: pEmail.trim(), tokenQuota: Number(pQuota),
        }),
      });
      setProvOpen(false);
      setPName(''); setPCode(''); setPContact(''); setPEmail(''); setPQuota('1000000');
      router.refresh();
    } catch (e) {
      setPErr(e instanceof Error ? e.message : '开通失败');
    } finally { setBusy(false); }
  }

  async function handleSetStatus(id: string, status: 'active' | 'suspended') {
    if (busy) return;
    const verb = status === 'suspended' ? '暂停' : '恢复';
    if (!window.confirm(`确认${verb}该租户？`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tenants/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失败');
    } finally { setBusy(false); }
  }

  // 4.8.9：注销租户（软删）。替代原死按钮。
  async function handleDelete(id: string, name: string) {
    if (busy) return;
    if (!window.confirm(`确认注销租户「${name}」？此操作为软删除，租户及其成员将立即不可用。`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tenants/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '注销失败');
    } finally { setBusy(false); }
  }

  // 平台真实计数（跨租户用量/收入需另接聚合，此处只展示租户数量态）
  const nActive = tenants.filter((t) => t.status === 'active').length;
  const nSuspended = tenants.filter((t) => t.status === 'suspended').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">租户管理</h1>
          <p className="text-muted-foreground">管理平台企业租户</p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => { setPErr(null); setProvOpen(true); }}>
            <Plus className="h-4 w-4" />
            开通企业
          </Button>
        )}
      </div>

      {/* Stats（真实计数） */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{tenants.length}</p>
                <p className="text-xs text-muted-foreground">企业租户</p>
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
              <div>
                <p className="text-lg font-semibold text-foreground">{nActive}</p>
                <p className="text-xs text-muted-foreground">活跃</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Ban className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{nSuspended}</p>
                <p className="text-xs text-muted-foreground">已停用</p>
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
                        {canManage && (
                          tenant.status === 'suspended' ? (
                            <DropdownMenuItem onClick={() => handleSetStatus(tenant.id, 'active')} disabled={busy}>
                              <Ban className="h-4 w-4 mr-2" />
                              恢复服务
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSetStatus(tenant.id, 'suspended')} disabled={busy}>
                              <Ban className="h-4 w-4 mr-2" />
                              暂停服务
                            </DropdownMenuItem>
                          )
                        )}
                        {canManage && (
                          <DropdownMenuItem className="text-destructive" disabled={busy}
                            onClick={() => handleDelete(tenant.id, tenant.name)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            注销租户
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

      {/* Revenue Chart Placeholder */}
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

      {/* 开通企业（ADR-010 / PRD 2.9.8）*/}
      <Dialog open={provOpen} onOpenChange={setProvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开通企业</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">企业名称</Label>
                <Input id="t-name" value={pName} onChange={e => setPName(e.target.value)} placeholder="示范科技有限公司" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-code">企业编码</Label>
                <Input id="t-code" value={pCode} onChange={e => setPCode(e.target.value)} placeholder="demo-tech" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-contact">联系人姓名</Label>
                <Input id="t-contact" value={pContact} onChange={e => setPContact(e.target.value)} placeholder="张三" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-email">邮箱</Label>
                <Input id="t-email" type="email" value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="admin@demo.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-quota">Token 配额</Label>
              <Input id="t-quota" type="number" value={pQuota} onChange={e => setPQuota(e.target.value)} placeholder="1000000" />
            </div>
            {pErr && <p className="text-xs text-destructive">{pErr}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleProvision} disabled={busy}>
              {busy ? '开通中…' : '提交开通'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
