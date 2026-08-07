'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import {
  Plus, Server, CheckCircle2, Clock, XCircle, Ban, KeyRound, Wrench,
  Search, Loader2, ChevronRight, ShieldAlert,
} from 'lucide-react';

// ADR-024：MCP 页以 **Server** 为主体，不再有 MCP Plugin。
//
// 规范里客户端不预注册 tools——Server 通过 tools/list 动态提供。
// 此前把 MCP 套进为 API/DB 设计的 Plugin+Tool 模型，产生了 164 条既无来源、
// 也无调用路径的静态 Tool 副本。现在列表直接列 Server，点开实时拉取它的 tools。

type McpStatus = 'draft' | 'pending' | 'approved' | 'disabled';
type McpServer = {
  id: string; name: string; description: string; type: string; endpoint: string;
  status: McpStatus; securityLevel: string; allowedRoles: string[]; allowedDepartments: string[];
};
type McpTool = { name: string; description: string; inputSchema?: Record<string, unknown> };

const STATUS_META: Record<McpStatus, { label: string; icon: typeof Clock; cls: string }> = {
  draft: { label: '草稿', icon: XCircle, cls: 'bg-muted text-muted-foreground' },
  pending: { label: '待审批', icon: Clock, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40' },
  approved: { label: '已就绪', icon: CheckCircle2, cls: 'bg-green-50 text-green-700 dark:bg-green-950/40' },
  disabled: { label: '已禁用', icon: Ban, cls: 'bg-destructive/10 text-destructive' },
};

const TYPE_LABEL: Record<string, string> = {
  builtin: '平台内置', enterprise: '企业自建', third_party: '第三方服务', private: '私有部署',
};

const ROLES = ['Admin', 'Developer', 'User', 'Auditor'];
const emptyForm = { name: '', endpoint: '', description: '', type: 'third_party', allowedRoles: ['Admin'] as string[] };

export function McpPageView() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  // 展开的 Server 及其实时 tools。不落库——tools 由 Server 动态提供且随时会变
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toolsState, setToolsState] = useState<{ loading: boolean; tools?: McpTool[]; error?: string; at?: string }>({ loading: false });

  useEffect(() => {
    apiFetch<{ servers: McpServer[] }>('/api/mcp-servers')
      .then((d) => setServers(d?.servers ?? []))
      .catch((e) => { if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true); })
      .finally(() => setLoading(false));
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await apiFetch<{ servers: McpServer[] }>('/api/mcp-servers');
      setServers(d?.servers ?? []);
    } catch { /* 保留旧列表 */ }
  }, []);

  async function toggleExpand(s: McpServer) {
    if (expandedId === s.id) { setExpandedId(null); return; }
    setExpandedId(s.id);
    if (!s.endpoint) {
      setToolsState({ loading: false, error: '该 Server 尚未配置 Endpoint，无法拉取工具清单' });
      return;
    }
    setToolsState({ loading: true });
    try {
      const r = await apiFetch<{ ok: boolean; tools?: McpTool[]; message?: string; fetchedAt?: string }>(
        `/api/mcp-servers/${s.id}/tools`,
      );
      setToolsState(r.ok
        ? { loading: false, tools: r.tools ?? [], at: r.fetchedAt }
        : { loading: false, error: r.message ?? '拉取失败' });
    } catch (e) {
      setToolsState({ loading: false, error: e instanceof Error ? e.message : '拉取失败' });
    }
  }

  async function transition(id: string, action: 'submit' | 'approve' | 'reject' | 'disable' | 'enable') {
    setBusy(id);
    try {
      await apiFetch(`/api/mcp-servers/${id}/transition`, { method: 'POST', body: JSON.stringify({ action }) });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally { setBusy(null); }
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.endpoint.trim()) { setError('名称与 Endpoint 必填'); return; }
    setCreating(true); setError(null);
    try {
      await apiFetch('/api/mcp-servers', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false); setForm(emptyForm);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally { setCreating(false); }
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-50" />无权限查看 MCP Server。
        </CardContent></Card>
      </div>
    );
  }

  const filtered = servers.filter((s) => {
    const kw = searchTerm.toLowerCase();
    const hit = s.name.toLowerCase().includes(kw) || (s.description ?? '').toLowerCase().includes(kw) || (s.endpoint ?? '').toLowerCase().includes(kw);
    if (activeTab === 'all') return hit;
    if (activeTab === 'unconfigured') return hit && !s.endpoint;
    return hit && s.status === activeTab;
  });
  const unconfigured = servers.filter((s) => !s.endpoint).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Plugin · MCP</h1>
          {/* 说清 MCP 与 API/DB 的模型差异——用户此前正因这点困惑 */}
          <p className="text-sm text-muted-foreground mt-0.5">
            注册并管理 MCP Server。工具由 Server 动态提供，无需逐个登记 —— 点开任一 Server 即可查看其当前工具。
          </p>
        </div>
        <Button className="gap-1.5 shadow-sm" data-testid="create-mcp-server"
          onClick={() => { setError(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />注册 MCP Server
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索 Server 名称、说明或地址..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all">全部 {servers.length}</TabsTrigger>
            <TabsTrigger value="approved">已就绪</TabsTrigger>
            <TabsTrigger value="pending">待审批</TabsTrigger>
            <TabsTrigger value="draft">草稿</TabsTrigger>
            {unconfigured > 0 && <TabsTrigger value="unconfigured">待填地址 {unconfigured}</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
            <Loader2 className="h-4 w-4 animate-spin" />加载中...
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">
            {servers.length === 0 ? '还没有注册任何 MCP Server。点右上角「注册 MCP Server」开始。' : '没有符合条件的 Server'}
          </p>
        ) : filtered.map((s) => {
          const meta = STATUS_META[s.status] ?? STATUS_META.draft;
          const Icon = meta.icon;
          const open = expandedId === s.id;
          return (
            <Card key={s.id} className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <button onClick={() => toggleExpand(s)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <Badge className={`text-[10px] gap-1 ${meta.cls}`}><Icon className="h-2.5 w-2.5" />{meta.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[s.type] ?? s.type}</Badge>
                      {!s.endpoint && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-500/30">
                          <KeyRound className="h-2.5 w-2.5" />待填地址
                        </Badge>
                      )}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                    <p className="text-[11px] text-muted-foreground font-mono mt-1 truncate">
                      {s.endpoint || '— 未配置 Endpoint —'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {s.status === 'draft' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === s.id || !s.endpoint}
                        onClick={() => transition(s.id, 'submit')}>提交审批</Button>
                    )}
                    {s.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === s.id}
                          onClick={() => transition(s.id, 'approve')}>通过</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy === s.id}
                          onClick={() => transition(s.id, 'reject')}>驳回</Button>
                      </>
                    )}
                    {s.status === 'approved' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={busy === s.id}
                        onClick={() => transition(s.id, 'disable')}>禁用</Button>
                    )}
                    {s.status === 'disabled' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === s.id}
                        onClick={() => transition(s.id, 'enable')}>启用</Button>
                    )}
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">该 Server 提供的工具</span>
                      {toolsState.at && (
                        <span className="text-[10px] text-muted-foreground">
                          实时拉取 · {new Date(toolsState.at).toLocaleTimeString('zh-CN')}
                        </span>
                      )}
                    </div>
                    {toolsState.loading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3 w-3 animate-spin" />正在连接 Server 拉取工具清单…
                      </div>
                    ) : toolsState.error ? (
                      <p className="text-xs text-destructive py-1">{toolsState.error}</p>
                    ) : toolsState.tools && toolsState.tools.length > 0 ? (
                      <div className="space-y-1.5">
                        {toolsState.tools.map((t) => (
                          <div key={t.name} className="rounded-md border border-border bg-background px-2.5 py-1.5">
                            <div className="text-xs font-mono text-foreground">{t.name}</div>
                            {t.description && <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-1">该 Server 未暴露任何工具</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>注册 MCP Server</DialogTitle>
            <DialogDescription>
              填入外部 MCP 服务的地址与访问方式。注册后为草稿，需提交审批通过才能被 Agent / Skill 调用。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mcp-name">名称</Label>
              <Input id="mcp-name" value={form.name} placeholder="如：汇联易发票查验"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mcp-endpoint">Endpoint</Label>
              <Input id="mcp-endpoint" value={form.endpoint} placeholder="https://example.com/mcp"
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                须为可从服务器访问的公网 http/https 地址；内网与本机地址会被拒绝。
              </p>
            </div>
            <div>
              <Label htmlFor="mcp-desc">说明</Label>
              <Input id="mcp-desc" value={form.description} placeholder="这个 Server 提供什么能力"
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mcp-type">类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger id="mcp-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>可见角色</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ROLES.map((r) => {
                  const on = form.allowedRoles.includes(r);
                  return (
                    <button key={r} type="button"
                      onClick={() => setForm({ ...form, allowedRoles: on ? form.allowedRoles.filter((x) => x !== r) : [...form.allowedRoles, r] })}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        on ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}>{r}</button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={creating} onClick={handleCreate}>{creating ? '注册中…' : '注册'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
