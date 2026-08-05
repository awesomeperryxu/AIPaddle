'use client';

import React, { useState, useEffect } from 'react';
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
  Coins,
  Wallet,
  Ban,
  Trash2,
  Eye,
  Loader2
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
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

// 每租户真实用量（来自 /api/platform/tenant-usage 聚合，ADR-008 只经 apiFetch）
type TenantUsage = {
  members: number; agents: number; tokens30d: number; estCost30d: number;
  // 4.8.17a/b：按 Key 来源拆分。estCost30d 只含平台侧（BYO 平台零成本）
  platformTokens30d: number; byoTokens30d: number; unknownTokens30d: number;
  keyMode: 'byo' | 'platform' | 'mixed' | 'none';
};

// 4.8.17b：Key 来源徽标
const keyModeConfig: Record<TenantUsage['keyMode'], { label: string; className: string; hint: string }> = {
  byo:      { label: '自配 Key',  className: 'bg-blue-500/10 text-blue-500',   hint: '租户使用自己的 LLM API Key，平台无 Token 成本' },
  platform: { label: '平台 Key',  className: 'bg-primary/10 text-primary',     hint: '使用平台 Key 调用，Token 成本由平台承担' },
  mixed:    { label: '混用',      className: 'bg-yellow-500/10 text-yellow-500', hint: '已配自有 Key，但仍有部分调用回退到平台 Key（如非 OpenAI 兼容供应商）' },
  none:     { label: '未调用',    className: 'bg-muted text-muted-foreground', hint: '近 30 天无调用记录' },
};

// 4.8.15a：租户详情（GET /api/tenants/[id]，含用量统计）
type TenantDetail = PlatformTenant & {
  storageQuota: number; memberCount: number; agentCount: number;
  tokensUsed30d: number; storageUsed: number;
};
type RevenuePoint = { label: string; cost: number };

// 4.8.17c：模型定价（版本化，按 effectiveFrom 生效）
type ModelPrice = {
  id: string; provider: string; model: string;
  inputPer1k: number; outputPer1k: number; currency: string;
  effectiveFrom: string; sourceNote: string | null;
};
const PRICING_STALE_DAYS = 90;
type UsageResp = { usage: Record<string, TenantUsage>; revenueTrend: RevenuePoint[] };

export function TenantsView({
  tenants = [],
  canManage = false,
  initialUsage,
}: {
  tenants?: PlatformTenant[];
  canManage?: boolean;
  initialUsage?: Record<string, { members: number; agents: number; tokens30d: number; calls30d: number; estCost30d: number }>;
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
  const [pAdminPwd, setPAdminPwd] = useState('');   // 4.8.18：开通即建 Admin，密码由开通人指定
  const [pErr, setPErr] = useState<string | null>(null);

  // 真实用量聚合（客户端拉取，ADR-008 只经 apiFetch）
  // 🔴 用服务端传入的 initialUsage 初始化，避免页面打开时先显示 0 再刷新
  const [usage, setUsage] = useState<Record<string, TenantUsage>>(
    (initialUsage as Record<string, TenantUsage> | undefined) ?? {}
  );
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);

  // 4.8.17c/d：模型定价维护 + 陈旧告警
  const [pricing, setPricing] = useState<ModelPrice[]>([]);
  const [priceOpen, setPriceOpen] = useState(false);
  const [pvProvider, setPvProvider] = useState('platform-env');
  const [pvModel, setPvModel] = useState('');
  const [pvIn, setPvIn] = useState('');
  const [pvOut, setPvOut] = useState('');
  const [pvNote, setPvNote] = useState('');
  const [pvErr, setPvErr] = useState<string | null>(null);
  const [pvBusy, setPvBusy] = useState(false);

  // 陈旧判定在数据回调里算而非渲染期——Date.now() 是非纯函数，
  // React 编译器 react-hooks/purity 禁止在渲染中调用（会让渲染结果不确定）
  const [latestPriceAt, setLatestPriceAt] = useState<string | null>(null);
  const [pricingStale, setPricingStale] = useState(false);

  const reloadPricing = () =>
    apiFetch<{ pricing: ModelPrice[] }>('/api/model-pricing')
      .then((d) => {
        const rows = d.pricing ?? [];
        setPricing(rows);
        const latest = rows.reduce<string | null>(
          (m, p) => (!m || p.effectiveFrom > m ? p.effectiveFrom : m), null);
        setLatestPriceAt(latest);
        // 没有实时价格 API（DashScope 只公示文档价），只能靠「多久没维护」提醒
        setPricingStale(!latest ||
          Date.now() - new Date(latest).getTime() > PRICING_STALE_DAYS * 24 * 3600 * 1000);
      })
      .catch(() => { /* 定价拉取失败不阻断列表 */ });

  useEffect(() => { void reloadPricing(); }, []);

  async function handleAddPrice() {
    if (pvBusy) return;
    setPvBusy(true); setPvErr(null);
    try {
      await apiFetch('/api/model-pricing', {
        method: 'POST',
        body: JSON.stringify({
          provider: pvProvider.trim(), model: pvModel.trim(),
          inputPer1k: Number(pvIn), outputPer1k: Number(pvOut),
          sourceNote: pvNote.trim() || null,
        }),
      });
      setPvModel(''); setPvIn(''); setPvOut(''); setPvNote('');
      await reloadPricing();
      router.refresh();
    } catch (e) {
      setPvErr(e instanceof Error ? e.message : '新增定价失败');
    } finally { setPvBusy(false); }
  }

  // 租户成员展开
  type TenantMember = { id: string; name: string; email: string; department: string; status: string; roles: string[]; createdAt: string }
  const [expandedMembersId, setExpandedMembersId] = useState<string | null>(null);
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  async function toggleMembers(tenantId: string) {
    if (expandedMembersId === tenantId) { setExpandedMembersId(null); return; }
    setExpandedMembersId(tenantId);
    setTenantMembers([]);  // 🔴 立即清空旧数据，否则切换时会先显示上一个租户的成员
    setMembersLoading(true);
    try {
      const r = await apiFetch<{ members: TenantMember[] }>(`/api/tenants/${tenantId}/members`);
      setTenantMembers(r.members ?? []);
    } catch { setTenantMembers([]); }
    finally { setMembersLoading(false); }
  }

  // 4.8.15a/b：租户详情抽屉（承载查看详情 / 编辑信息 / 配额管理三项）
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [dSaving, setDSaving] = useState(false);
  const [fName, setFName] = useState('');
  const [fContact, setFContact] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fToken, setFToken] = useState('');
  const [fStorage, setFStorage] = useState('');
  const [fQps, setFQps] = useState('');

  // 打开抽屉：重置态在触发处做，effect 内不同步 setState（React 编译器
  // react-hooks/set-state-in-effect 会报级联渲染，项目 4.6.2 已踩过同一条）
  function openDetail(id: string) {
    setDetail(null); setDErr(null); setDLoading(true);
    setDetailId(id);
  }

  useEffect(() => {
    if (!detailId) return;
    let alive = true;
    apiFetch<{ tenant: TenantDetail }>(`/api/tenants/${detailId}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d.tenant);
        setFName(d.tenant.name);
        setFContact(d.tenant.contactName ?? '');
        setFEmail(d.tenant.contactEmail ?? '');
        setFToken(String(d.tenant.tokenQuota ?? 0));
        setFStorage(String(d.tenant.storageQuota ?? 0));
        setFQps(String(d.tenant.qpsLimit ?? 0));
      })
      .catch((e) => { if (alive) setDErr(e instanceof Error ? e.message : '加载失败'); })
      .finally(() => { if (alive) setDLoading(false); });
    return () => { alive = false; };
  }, [detailId]);

  async function handleSaveDetail() {
    if (!detailId || dSaving) return;
    setDSaving(true); setDErr(null);
    try {
      await apiFetch(`/api/tenants/${detailId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: fName.trim(),
          contactName: fContact.trim() || null,
          contactEmail: fEmail.trim(),
          tokenQuota: Number(fToken),
          storageQuota: Number(fStorage),
          qpsLimit: Number(fQps),
        }),
      });
      setDetailId(null);
      router.refresh();
    } catch (e) {
      setDErr(e instanceof Error ? e.message : '保存失败');
    } finally { setDSaving(false); }
  }

  useEffect(() => {
    let alive = true;
    apiFetch<UsageResp>('/api/platform/tenant-usage')
      .then((d) => {
        if (!alive) return;
        setUsage(d.usage ?? {});
        setRevenueTrend(d.revenueTrend ?? []);
      })
      .catch(() => { /* 拉取失败：用量列回落 0，不阻断列表 */ });
    return () => { alive = false; };
  }, []);

  // 真实租户映射到表格展示 shape（用量/费用来自聚合，缺记录的租户回落真实 0）
  const displayTenants: Tenant[] = tenants.map((t) => {
    const u = usage[t.id];
    return {
      id: t.id, name: t.name, adminEmail: t.contactEmail || t.code,
      status: t.status,
      members: u?.members ?? 0, agents: u?.agents ?? 0,
      tokenUsage: u?.tokens30d ?? 0, tokenQuota: t.tokenQuota,
      monthlyBill: u?.estCost30d ?? 0,
      createdAt: t.createdAt,
    };
  });

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
          adminPassword: pAdminPwd,
        }),
      });
      setProvOpen(false);
      setPName(''); setPCode(''); setPContact(''); setPEmail(''); setPQuota('1000000'); setPAdminPwd('');
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

  // 平台真实聚合：总用户 / 本月 Token / 本月收入（估算）
  const totals = Object.values(usage).reduce(
    (a, u) => ({
      members: a.members + u.members,
      tokens30d: a.tokens30d + u.tokens30d,
      estCost30d: a.estCost30d + u.estCost30d,
    }),
    { members: 0, tokens30d: 0, estCost30d: 0 },
  );

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

      {/* Stats（真实聚合：近 30 天用量）——点击查看每租户明细 */}
      <div className="grid grid-cols-3 gap-4">
        <Card
          role="button" tabIndex={0} onClick={() => router.push('/platform-metrics/members')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/platform-metrics/members'); } }}
          className="bg-card border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{totals.members.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">总用户 · 查看明细</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          role="button" tabIndex={0} onClick={() => router.push('/platform-metrics/tokens')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/platform-metrics/tokens'); } }}
          className="bg-card border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{(totals.tokens30d / 1000000).toFixed(2)}M</p>
                <p className="text-xs text-muted-foreground">本月 Token · 查看明细</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          role="button" tabIndex={0} onClick={() => router.push('/platform-metrics/cost')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/platform-metrics/cost'); } }}
          className="bg-card border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">¥{totals.estCost30d.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">本月收入（估算）· 查看明细</p>
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
                <TableHead className="text-muted-foreground">Key 来源</TableHead>
                <TableHead className="text-muted-foreground">成员数</TableHead>
                <TableHead className="text-muted-foreground">Agent 数</TableHead>
                <TableHead className="text-muted-foreground">Token 用量</TableHead>
                <TableHead className="text-muted-foreground">本月账单</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <React.Fragment key={tenant.id}>
                <TableRow className="border-border">
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
                  {/* 4.8.17b：该租户用的是自己的 LLM Key 还是平台的 */}
                  <TableCell>
                    {(() => {
                      const m = usage[tenant.id]?.keyMode ?? 'none';
                      const c = keyModeConfig[m];
                      return <Badge className={c.className} title={c.hint}>{c.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-foreground hover:text-primary underline decoration-dotted underline-offset-4 transition-colors"
                      onClick={(e) => { e.stopPropagation(); toggleMembers(tenant.id); }}
                    >
                      {tenant.members.toLocaleString()} 人
                    </button>
                  </TableCell>
                  <TableCell className="text-foreground">{tenant.agents}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">{(tenant.tokenUsage / 1000000).toFixed(2)}M / {(tenant.tokenQuota / 1000000).toFixed(0)}M</p>
                      <div className="w-24 h-1.5 bg-muted rounded-full">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${tenant.tokenQuota > 0 ? Math.min(100, (tenant.tokenUsage / tenant.tokenQuota) * 100) : 0}%` }}
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
                        {/* 4.8.15a/b：详情抽屉承接「查看详情 / 编辑信息 / 配额管理」。
                            BUG-82 的 6 个空菜单此前由 PR #118 直接移除；本次把其中三项以
                            真实可用的形式加回（另三项账单/模型配置/MCP 审批仍无按租户维度的
                            后端能力，见 4.8.15c / 4.8.10，做完再放）。 */}
                        <DropdownMenuItem onClick={() => openDetail(tenant.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {canManage ? '详情与配额' : '查看详情'}
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
                {/* 展开的成员列表 */}
                {expandedMembersId === tenant.id && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={8} className="p-0">
                      <div className="px-6 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {tenant.name} 的成员 {membersLoading && '（加载中...）'}
                        </p>
                        {!membersLoading && tenantMembers.length === 0 && (
                          <p className="text-xs text-muted-foreground">暂无成员</p>
                        )}
                        {tenantMembers.length > 0 && (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1 pr-4 font-medium">姓名</th>
                                <th className="text-left py-1 pr-4 font-medium">邮箱</th>
                                <th className="text-left py-1 pr-4 font-medium">角色</th>
                                <th className="text-left py-1 pr-4 font-medium">部门</th>
                                <th className="text-left py-1 font-medium">状态</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tenantMembers.map(m => (
                                <tr key={m.id} className="border-t border-border/30">
                                  <td className="py-1.5 pr-4 text-foreground">{m.name || '—'}</td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{m.email}</td>
                                  <td className="py-1.5 pr-4">
                                    {m.roles.map(r => (
                                      <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0 h-4 mr-1">{r}</Badge>
                                    ))}
                                  </td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{m.department || '—'}</td>
                                  <td className="py-1.5">
                                    <span className={`inline-flex items-center gap-1 ${m.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                                      {m.status === 'active' ? '正常' : m.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Revenue Chart（真实：近 6 个月估算收入，按 Token 用量推算） */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-foreground">平台 Token 成本趋势（估算）</CardTitle>
              <CardDescription>
                过去 6 个月平台侧成本，按调用当时生效的单价推算，非真实账单；
                租户自配 Key（BYO）平台零成本，已排除在外
              </CardDescription>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => { setPvErr(null); setPriceOpen(true); }}>
                模型定价
              </Button>
            )}
          </div>
          {/* 4.8.17d：没有实时价格 API，只能靠「多久没维护」提醒单价可能已漂移 */}
          {pricingStale && (
            <p className="mt-2 text-xs text-yellow-500">
              ⚠️ 定价已超过 {PRICING_STALE_DAYS} 天未更新
              {latestPriceAt ? `（最近生效 ${latestPriceAt.slice(0, 10)}）` : '（尚未配置任何定价）'}
              ，成本估算可能与供应商现价不符。供应商无价格查询 API，需人工核对官方定价页后更新。
            </p>
          )}
        </CardHeader>
        <CardContent>
          {revenueTrend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            (() => {
              const max = Math.max(1, ...revenueTrend.map((p) => p.cost));
              return (
                <div className="h-48 flex items-end justify-between gap-2 px-4">
                  {revenueTrend.map((p) => {
                    const height = Math.round((p.cost / max) * 100);
                    return (
                      <div key={p.label} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs text-muted-foreground">¥{p.cost.toFixed(0)}</span>
                        <div className="w-full bg-primary/20 rounded-t-sm flex items-end" style={{ height: `${height}%` }}>
                          <div className="w-full bg-primary rounded-t-sm" style={{ height: '80%' }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
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
            {/* 4.8.18：开通企业时同时创建该企业 Admin 账号（联系邮箱即登录账号） */}
            <div className="space-y-1.5">
              <Label htmlFor="t-adminpwd">管理员初始密码</Label>
              <Input id="t-adminpwd" type="password" value={pAdminPwd} onChange={e => setPAdminPwd(e.target.value)}
                     placeholder="至少 8 位，含字母/数字/符号中至少两类" />
              <p className="text-xs text-muted-foreground">
                将以「联系邮箱」为账号创建该企业的 Admin，开通后即可登录；请把密码转告对方。
              </p>
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

      {/* 4.8.17c：模型定价维护。改价=新增一条生效档，不改既有行——历史成本按当时单价算，改价不篡改历史 */}
      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>模型定价</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              供应商未提供价格查询 API，单价需人工维护。
              <span className="text-foreground">改价请新增一条生效档</span>——历史调用仍按当时的单价计算，趋势图不会因改价而变形。
            </p>

            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">供应商 / 模型</TableHead>
                    <TableHead className="text-muted-foreground">输入 /1K</TableHead>
                    <TableHead className="text-muted-foreground">输出 /1K</TableHead>
                    <TableHead className="text-muted-foreground">生效起</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">暂无定价</TableCell></TableRow>
                  ) : pricing.map((p) => (
                    <TableRow key={p.id} className="border-border">
                      <TableCell className="text-foreground">
                        {p.model}
                        <span className="text-xs text-muted-foreground ml-1.5">{p.provider}</span>
                      </TableCell>
                      <TableCell className="text-foreground">¥{p.inputPer1k}</TableCell>
                      <TableCell className="text-foreground">¥{p.outputPer1k}</TableCell>
                      <TableCell className="text-muted-foreground">{p.effectiveFrom.slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 pt-1">
              <h4 className="text-sm font-medium text-foreground">新增生效档</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pv-provider">供应商</Label>
                  <Input id="pv-provider" value={pvProvider} onChange={e => setPvProvider(e.target.value)} placeholder="platform-env" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pv-model">模型（* 表示兜底档）</Label>
                  <Input id="pv-model" value={pvModel} onChange={e => setPvModel(e.target.value)} placeholder="qwen-plus" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pv-in">输入单价（元 / 1K token）</Label>
                  <Input id="pv-in" type="number" step="0.000001" min={0} value={pvIn} onChange={e => setPvIn(e.target.value)} placeholder="0.0008" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pv-out">输出单价（元 / 1K token）</Label>
                  <Input id="pv-out" type="number" step="0.000001" min={0} value={pvOut} onChange={e => setPvOut(e.target.value)} placeholder="0.0048" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pv-note">价格出处</Label>
                <Input id="pv-note" value={pvNote} onChange={e => setPvNote(e.target.value)} placeholder="阿里云百炼定价页，2026-07-28 查" />
              </div>
              {pvErr && <p className="text-xs text-destructive">{pvErr}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceOpen(false)} disabled={pvBusy}>关闭</Button>
            <Button onClick={handleAddPrice} disabled={pvBusy}>{pvBusy ? '保存中…' : '新增生效档'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4.8.15a/b：租户详情与配额抽屉。非管理员只读展示，Admin 可改基本信息与配额。 */}
      <Sheet open={detailId !== null} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.name ?? '租户详情'}</SheetTitle>
            <SheetDescription>
              {detail ? `企业编码 ${detail.code} · 开通于 ${detail.createdAt}` : '加载中…'}
            </SheetDescription>
          </SheetHeader>

          {dLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />加载中…
            </div>
          )}

          {detail && (
            <div className="px-4 space-y-6 pb-4">
              {/* 用量统计（只读） */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '成员数', value: detail.memberCount.toLocaleString() },
                  { label: 'Agent 数', value: detail.agentCount.toLocaleString() },
                  { label: '30 天 Token', value: detail.tokensUsed30d.toLocaleString() },
                  { label: '已用存储', value: `${(detail.storageUsed / 1024 / 1024).toFixed(1)} MB` },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-semibold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* 4.8.17b：Key 来源与成本归属 */}
              {(() => {
                const u = usage[detail.id];
                const mode = u?.keyMode ?? 'none';
                const c = keyModeConfig[mode];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">LLM Key 来源</h4>
                      <Badge className={c.className}>{c.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.hint}</p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded-md bg-muted/30 border border-border">
                        <p className="text-[11px] text-muted-foreground">平台 Key Token</p>
                        <p className="text-sm font-medium text-foreground">{(u?.platformTokens30d ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/30 border border-border">
                        <p className="text-[11px] text-muted-foreground">自配 Key Token</p>
                        <p className="text-sm font-medium text-foreground">{(u?.byoTokens30d ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-2 rounded-md bg-muted/30 border border-border">
                        <p className="text-[11px] text-muted-foreground">来源未知</p>
                        <p className="text-sm font-medium text-foreground">{(u?.unknownTokens30d ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      平台侧 30 天估算成本 <span className="text-foreground font-medium">¥{(u?.estCost30d ?? 0).toFixed(2)}</span>
                      ；仅按平台 Key 的 Token 计算，自配 Key 平台零成本。
                      「来源未知」为 2026-07-28 记录来源之前的历史调用，不计入成本。
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">基本信息</h4>
                <div className="space-y-1.5">
                  <Label htmlFor="d-name">企业名称</Label>
                  <Input id="d-name" value={fName} onChange={e => setFName(e.target.value)} disabled={!canManage} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-contact">联系人</Label>
                    <Input id="d-contact" value={fContact} onChange={e => setFContact(e.target.value)} disabled={!canManage} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="d-email">联系邮箱</Label>
                    <Input id="d-email" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} disabled={!canManage} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">企业编码 {detail.code} 不可修改（对外标识）</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">配额（0 表示不限制，改动立即生效）</h4>
                <div className="space-y-1.5">
                  <Label htmlFor="d-token">Token 配额（每 30 天）</Label>
                  <Input id="d-token" type="number" min={0} value={fToken} onChange={e => setFToken(e.target.value)} disabled={!canManage} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="d-storage">存储配额（字节）</Label>
                    <Input id="d-storage" type="number" min={0} value={fStorage} onChange={e => setFStorage(e.target.value)} disabled={!canManage} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="d-qps">QPS 上限</Label>
                    <Input id="d-qps" type="number" min={0} value={fQps} onChange={e => setFQps(e.target.value)} disabled={!canManage} />
                  </div>
                </div>
              </div>

              {dErr && <p className="text-xs text-destructive">{dErr}</p>}
            </div>
          )}

          {!dLoading && dErr && !detail && <p className="px-4 text-sm text-destructive">{dErr}</p>}

          <SheetFooter>
            <Button variant="outline" onClick={() => setDetailId(null)} disabled={dSaving}>关闭</Button>
            {canManage && detail && (
              <Button onClick={handleSaveDetail} disabled={dSaving}>
                {dSaving ? '保存中…' : '保存'}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
