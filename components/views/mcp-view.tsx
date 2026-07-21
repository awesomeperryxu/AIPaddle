'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import { Plus, Server, CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';

type McpStatus = 'draft' | 'pending' | 'approved' | 'disabled';
type McpServer = {
  id: string; name: string; description: string; type: string; endpoint: string;
  status: McpStatus; securityLevel: string; allowedRoles: string[]; allowedDepartments: string[];
};
type Props = { servers: McpServer[]; canCreate: boolean; canReview: boolean };

const statusConfig: Record<McpStatus, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: '草稿', icon: XCircle, className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审批', icon: Clock, className: 'bg-warning/10 text-warning' },
  approved: { label: '已审批', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600' },
  disabled: { label: '已禁用', icon: Ban, className: 'bg-destructive/10 text-destructive' },
};

const ROLES = ['Admin', 'Developer', 'User', 'Auditor'];
const emptyForm = { name: '', endpoint: '', type: 'enterprise', allowedRoles: ['Admin'] as string[] };

export function McpView({ servers, canCreate, canReview }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(id: string, action: 'submit' | 'approve' | 'reject' | 'disable' | 'enable') {
    setBusy(true);
    try {
      await apiFetch(`/api/mcp-servers/${id}/transition`, { method: 'POST', body: JSON.stringify({ action }) });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      await apiFetch('/api/mcp-servers', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, endpoint: form.endpoint, type: form.type, allowedRoles: form.allowedRoles }),
      });
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setCreating(false);
    }
  }

  const toggleRole = (r: string) =>
    setForm((f) => ({ ...f, allowedRoles: f.allowedRoles.includes(r) ? f.allowedRoles.filter((x) => x !== r) : [...f.allowedRoles, r] }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">MCP 管理中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">注册、审批、启停企业 MCP Server（ADR-004）</p>
        </div>
        {canCreate && (
          <Button className="gap-2 shadow-sm" data-testid="register-mcp" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />注册 Server
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {servers.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">暂无 MCP Server</p>}
        {servers.map((s) => {
          const StatusIcon = statusConfig[s.status].icon;
          return (
            <Card key={s.id} data-testid="mcp-row" data-mcp-name={s.name} className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-foreground truncate">{s.name}</h3>
                    <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                    <Badge className={`text-[10px] gap-1 ${statusConfig[s.status].className}`}>
                      <StatusIcon className="h-3 w-3" />{statusConfig[s.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{s.endpoint}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">可见角色：{s.allowedRoles.join('、') || '—'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {s.status === 'draft' && canCreate && (
                    <Button size="sm" disabled={busy} onClick={() => transition(s.id, 'submit')}>提交审批</Button>
                  )}
                  {s.status === 'pending' && canReview && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => transition(s.id, 'approve')}>批准</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => transition(s.id, 'reject')}>驳回</Button>
                    </>
                  )}
                  {s.status === 'approved' && canReview && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => transition(s.id, 'disable')}>禁用</Button>
                  )}
                  {s.status === 'disabled' && canReview && (
                    <Button size="sm" disabled={busy} onClick={() => transition(s.id, 'enable')}>启用</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 注册 Server */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>注册 MCP Server</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="mcp-name">名称</Label>
              <Input id="mcp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：企微通讯录" />
            </div>
            <div>
              <Label htmlFor="mcp-endpoint">Endpoint</Label>
              <Input id="mcp-endpoint" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['builtin', 'enterprise', 'third_party', 'private'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>可见角色（allowed_roles）</Label>
              <div className="flex gap-2 mt-1">
                {ROLES.map((r) => (
                  <button
                    key={r} type="button" onClick={() => toggleRole(r)}
                    className={`px-2.5 py-1 rounded-md text-xs border ${
                      form.allowedRoles.includes(r) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    }`}
                  >{r}</button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={creating || !form.name.trim() || !form.endpoint.trim()} onClick={handleCreate}>
              {creating ? '注册中...' : '注册'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
