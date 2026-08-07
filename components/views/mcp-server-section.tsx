'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import { Plus, Server, CheckCircle2, Clock, XCircle, Ban, ChevronDown, ChevronRight, KeyRound, Wrench } from 'lucide-react';

// ADR-023：MCP Server 注册区，嵌入 Plugin → MCP 页面。
//
// 为什么合并到一页：Server（连接层：endpoint/凭证/审批）与 Plugin（管理层：目录/市场）
// 本是同一件事的两面，分处两个入口时用户按提示去 Plugin 页填 Key，那里根本没有可填的地方
// ——这正是用户反馈「搞得很错乱」的来源。分层模型不变，只是交付形态合到一处。
//
// 自取数据而非由页面 props 注入：Plugin 页是客户端组件，两边保持一致的取数方式。

type McpStatus = 'draft' | 'pending' | 'approved' | 'disabled';
type McpServer = {
  id: string; name: string; description: string; type: string; endpoint: string;
  status: McpStatus; securityLevel: string; allowedRoles: string[]; allowedDepartments: string[];
};

const statusConfig: Record<McpStatus, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: '草稿', icon: XCircle, className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审批', icon: Clock, className: 'bg-amber-500/10 text-amber-600' },
  approved: { label: '已就绪', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600' },
  disabled: { label: '已禁用', icon: Ban, className: 'bg-destructive/10 text-destructive' },
};

const ROLES = ['Admin', 'Developer', 'User', 'Auditor'];
const emptyForm = { name: '', endpoint: '', type: 'enterprise', allowedRoles: ['Admin'] as string[] };

export function McpServerSection() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // ADR-024：tools 由 Server 动态提供，实时拉取不落库。
  // 库里存副本的下场本项目已经见过——164 条手工 Tool 记录既无来源也跑不通。
  type ToolsState = { loading: boolean; tools?: { name: string; description: string }[]; error?: string; at?: string };
  const [toolsByServer, setToolsByServer] = useState<Record<string, ToolsState>>({});

  async function loadTools(id: string) {
    setToolsByServer((m) => ({ ...m, [id]: { loading: true } }));
    try {
      const r = await apiFetch<{ ok: boolean; tools?: { name: string; description: string }[]; message?: string; fetchedAt?: string }>(
        `/api/mcp-servers/${id}/tools`,
      );
      setToolsByServer((m) => ({
        ...m,
        [id]: r.ok
          ? { loading: false, tools: r.tools ?? [], at: r.fetchedAt }
          : { loading: false, error: r.message ?? '拉取失败' },
      }));
    } catch (e) {
      setToolsByServer((m) => ({ ...m, [id]: { loading: false, error: e instanceof Error ? e.message : '拉取失败' } }));
    }
  }

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
    } catch { /* 保留旧列表，不清空 */ }
  }, []);

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
      await apiFetch('/api/mcp-servers', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, endpoint: form.endpoint, type: form.type, allowedRoles: form.allowedRoles }),
      });
      setCreateOpen(false); setForm(emptyForm);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally { setCreating(false); }
  }

  if (forbidden) return null; // 无 mcp:read 权限时整块不显示，权限仍由服务端强制

  const notReady = servers.filter((s) => s.status !== 'approved').length;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/40">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Server className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">MCP Server（连接层）</span>
        <span className="text-xs text-muted-foreground">
          {loading ? '加载中…' : `${servers.length} 个`}
          {notReady > 0 && ` · ${notReady} 个待配置`}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Plugin 是目录，Server 才承载 Endpoint 与密钥
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* 这句是刻意写的：用户此前按提示来 Plugin 页填 Key 却找不到入口 */}
          <p className="text-xs text-muted-foreground mb-3">
            外部 MCP 服务的 <span className="text-foreground">Endpoint 与 API Key 填在这里</span>；
            上方的 Plugin 只负责目录与发布。Server 需审批通过后才能被 Skill / Agent 调用。
          </p>

          {!loading && servers.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              还没有注册任何 MCP Server。点右侧「注册 Server」填入服务地址与密钥。
            </div>
          )}

          <div className="space-y-2">
            {servers.map((s) => {
              const sc = statusConfig[s.status] ?? statusConfig.draft;
              const Icon = sc.icon;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate">{s.name}</span>
                      <Badge className={`text-[10px] gap-1 ${sc.className}`}>
                        <Icon className="h-2.5 w-2.5" />{sc.label}
                      </Badge>
                      {!s.endpoint && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-500/30">
                          <KeyRound className="h-2.5 w-2.5" />待填连接信息
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">{s.endpoint || '— 未配置 Endpoint —'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.endpoint && (
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                        disabled={toolsByServer[s.id]?.loading}
                        onClick={() => loadTools(s.id)}>
                        {toolsByServer[s.id]?.loading ? '连接中…' : '查看工具'}
                      </Button>
                    )}
                    {s.status === 'draft' && (
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={busy === s.id || !s.endpoint}
                        onClick={() => transition(s.id, 'submit')}>提交审批</Button>
                    )}
                    {s.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={busy === s.id}
                          onClick={() => transition(s.id, 'approve')}>通过</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[11px]" disabled={busy === s.id}
                          onClick={() => transition(s.id, 'reject')}>驳回</Button>
                      </>
                    )}
                    {s.status === 'approved' && (
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] text-destructive" disabled={busy === s.id}
                        onClick={() => transition(s.id, 'disable')}>禁用</Button>
                    )}
                    {s.status === 'disabled' && (
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={busy === s.id}
                        onClick={() => transition(s.id, 'enable')}>启用</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 实时拉取的 tools 清单。刻意标注拉取时间——它是快照不是库里的记录，
              Server 侧变更后需重新点「查看工具」 */}
          <div className="space-y-2 mt-2">
            {Object.entries(toolsByServer).map(([id, st]) => {
              const s = servers.find((x) => x.id === id);
              if (!s || st.loading) return null;
              return (
                <div key={id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wrench className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-foreground">{s.name} 提供的工具</span>
                    {st.at && (
                      <span className="text-[10px] text-muted-foreground">
                        实时拉取 · {new Date(st.at).toLocaleTimeString('zh-CN')}
                      </span>
                    )}
                  </div>
                  {st.error ? (
                    <p className="text-[11px] text-destructive">{st.error}</p>
                  ) : st.tools && st.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {st.tools.map((t) => (
                        <span key={t.name} title={t.description}
                          className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-foreground">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">该 Server 未暴露任何工具</p>
                  )}
                </div>
              );
            })}
          </div>

          <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1.5" onClick={() => { setError(null); setCreateOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />注册 Server
          </Button>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>注册 MCP Server</DialogTitle>
            <DialogDescription>
              填入外部 MCP 服务的地址与访问密钥。注册后为草稿状态，需提交审批通过才能被调用。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mcp-name">名称</Label>
              <Input id="mcp-name" value={form.name} placeholder="如：汇联易票证核验"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mcp-endpoint">Endpoint</Label>
              <Input id="mcp-endpoint" value={form.endpoint} placeholder="https://example.com/mcp"
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mcp-type">类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger id="mcp-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">企业自建</SelectItem>
                  <SelectItem value="third_party">第三方服务</SelectItem>
                  <SelectItem value="builtin">平台内置</SelectItem>
                  <SelectItem value="private">私有部署</SelectItem>
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
                      onClick={() => setForm({
                        ...form,
                        allowedRoles: on ? form.allowedRoles.filter((x) => x !== r) : [...form.allowedRoles, r],
                      })}
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
