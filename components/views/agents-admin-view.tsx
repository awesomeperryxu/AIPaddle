'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Agent } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import { actionsFor, ACTION_LABEL, TRANSITIONS, type TransitionAction } from '@/lib/agents/status';
import {
  Plus,
  Search,
  Settings,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Zap,
  Copy,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-orange-400',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-500',
];
function getAvatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const statusConfig = {
  draft:     { label: '草稿',   dotClass: 'bg-muted-foreground', pillClass: 'text-muted-foreground' },
  pending:   { label: '待审核', dotClass: 'bg-amber-500',        pillClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  published: { label: '已发布', dotClass: 'bg-green-500',        pillClass: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  offline:   { label: '已下线', dotClass: 'bg-destructive',      pillClass: 'text-destructive bg-destructive/10' },
};

export function AgentsAdminView({
  agents = [],
  canCreate = false,
  canDelete = false,
  canEdit = false,
  canSubmit = false,
  canReview = false,
}: {
  agents?: Agent[];
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canSubmit?: boolean;
  canReview?: boolean;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // 轻量提示
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((m: string) => {
    setNotice(m);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2600);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // 创建 Agent 弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // AI 帮我建（Copilot 4.1.6）；?assistant=<描述> → 自动打开并预填
  const searchParams = useSearchParams();
  const assistantDesc = searchParams.get('assistant') ?? '';
  const [copilotOpen, setCopilotOpen] = useState(() => !!assistantDesc && canCreate);
  const [copilotDesc, setCopilotDesc] = useState(assistantDesc);
  const [copiloting, setCopiloting] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  async function handleCopilot() {
    if (copilotDesc.trim().length < 4) { setCopilotError('请多描述一点需求'); return; }
    setCopiloting(true); setCopilotError(null);
    try {
      await apiFetch('/api/agents/copilot', { method: 'POST', body: JSON.stringify({ description: copilotDesc }) });
      setCopilotOpen(false); setCopilotDesc('');
      router.refresh();
    } catch (e) {
      setCopilotError(e instanceof Error ? e.message : '生成失败');
    } finally { setCopiloting(false); }
  }

  // 编辑 Agent 弹窗
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({ name: '', department: '', description: '' });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(agent: Agent) {
    setEditTarget(agent);
    setEditForm({ name: agent.name, department: agent.department, description: agent.description });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!editForm.name.trim()) { setEditError('名称不能为空'); return; }
    setEditing(true); setEditError(null);
    try {
      await apiFetch(`/api/agents/${editTarget.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败');
    } finally { setEditing(false); }
  }

  // 删除 Agent（软删除）
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function handleDelete(agent: Agent) {
    if (deletingId) return;
    if (!window.confirm(`确定删除 Agent「${agent.name}」？删除后可在回收站找回（软删除）。`)) return;
    setDeletingId(agent.id);
    try {
      await apiFetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally { setDeletingId(null); }
  }

  // 状态机流转（4.1.2）
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  function availableActions(agent: Agent): TransitionAction[] {
    return actionsFor(agent.status).filter(a => {
      const perm = TRANSITIONS[a].action;
      if (perm === 'agent:submit') return canSubmit;
      if (perm === 'agent:review') return canReview;
      if (perm === 'agent:update') return canEdit;
      return false;
    });
  }
  async function handleTransition(agent: Agent, action: TransitionAction) {
    if (transitioningId) return;
    setTransitioningId(agent.id);
    try {
      await apiFetch(`/api/agents/${agent.id}/transition`, { method: 'POST', body: JSON.stringify({ action }) });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失败');
    } finally { setTransitioningId(null); }
  }

  async function handleCreate() {
    if (!form.name.trim()) { setCreateError('名称不能为空'); return; }
    setCreating(true); setCreateError(null);
    try {
      const res = await apiFetch<{ agent: { id: string } }>('/api/agents', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false);
      setForm({ name: '', department: '', description: '' });
      if (res?.agent?.id) router.push(`/agents-admin/${res.agent.id}`);
      else router.refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败');
    } finally { setCreating(false); }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.department.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && agent.status === activeTab;
  });

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agent 管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建、配置和管理 AI Agent（数字员工）</p>
        </div>
        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                创建 Agent
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setCopilotOpen(true)}>
                <Zap className="h-4 w-4 mr-2 text-primary" />
                AI 帮我建
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建空白 Agent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/templates')}>
                <Copy className="h-4 w-4 mr-2" />
                从模板创建
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => showNotice('导入 DSL 文件：即将上线（4.1.8/4.4.12）')}>
                <Settings className="h-4 w-4 mr-2" />
                导入 DSL 文件
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={copilotOpen} onOpenChange={setCopilotOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>AI 帮我建 Agent</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">描述你想要的 Agent，AI 生成配置草稿（草稿态，发布仍需走审核）。</p>
          {copilotError && <p className="text-sm text-red-500">{copilotError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="copilot-desc">需求描述</Label>
            <Input id="copilot-desc" value={copilotDesc} onChange={e => setCopilotDesc(e.target.value)}
              placeholder="例如：一个处理客户售后投诉的客服助手，语气耐心专业" />
          </div>
          <DialogFooter>
            <Button onClick={handleCopilot} disabled={copiloting}>{copiloting ? 'AI 生成中...' : '生成草稿'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建空白 Agent</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">填写基本信息，创建后进入编排页配置提示词/模型/工具（草稿态，发布须走审核）。</p>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">名称</Label>
              <Input id="agent-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Agent 名称" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-dept">部门</Label>
              <Input id="agent-dept" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="所属部门" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-desc">描述</Label>
              <Input id="agent-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Agent 用途描述" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating}>{creating ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑 Agent</DialogTitle></DialogHeader>
          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">名称</Label>
              <Input id="edit-name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Agent 名称" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept">部门</Label>
              <Input id="edit-dept" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} placeholder="所属部门" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">描述</Label>
              <Input id="edit-desc" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Agent 描述" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={editing}>{editing ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground/90 px-4 py-2 text-sm text-background shadow-lg">
          {notice}
        </div>
      )}

      {/* ── Search + Tabs ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Agent 名称或部门..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">全部</TabsTrigger>
            <TabsTrigger value="published" className="text-xs px-3">已发布</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3">待审核</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs px-3">草稿</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Agent List ── */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredAgents.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-16">暂无 Agent</p>
        )}
        {filteredAgents.map((agent) => {
          const sc = statusConfig[agent.status] ?? statusConfig.draft;
          const actions = availableActions(agent);
          return (
            <div
              key={agent.id}
              className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => router.push(`/agents-admin/${agent.id}`)}
            >
              {/* 彩色首字 Avatar */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold text-white shrink-0 ${getAvatarBg(agent.name)}`}>
                {agent.name.charAt(0)}
              </div>

              {/* 名称 + 描述·模型 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground leading-tight">{agent.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {agent.description}
                  {agent.model ? <span className="text-muted-foreground/60"> · {agent.model}</span> : null}
                </p>
              </div>

              {/* 状态 pill */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${sc.pillClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dotClass}`} />
                {sc.label}
              </div>

              {/* 调用次数 */}
              <span className="text-sm text-muted-foreground w-28 text-right shrink-0">
                {agent.calls.toLocaleString()} 次调用
              </span>

              {/* 编辑按钮（阻止冒泡，直接进编排页） */}
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={(e) => { e.stopPropagation(); router.push(`/agents-admin/${agent.id}`); }}
              >
                编辑
              </Button>

              {/* 状态流转 + 删除（三点菜单，次要操作） */}
              {(actions.length > 0 || canDelete || canEdit) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEdit(agent)}>
                        <Settings className="h-4 w-4 mr-2" />
                        编辑信息
                      </DropdownMenuItem>
                    )}
                    {actions.map(action => (
                      <DropdownMenuItem
                        key={action}
                        disabled={transitioningId === agent.id}
                        onSelect={(e) => { e.preventDefault(); handleTransition(agent, action); }}
                      >
                        {action === 'offline' ? <Pause className="h-4 w-4 mr-2" /> :
                         action === 'reject'  ? <XCircle className="h-4 w-4 mr-2" /> :
                                                <Play className="h-4 w-4 mr-2" />}
                        {transitioningId === agent.id ? '处理中...' : ACTION_LABEL[action]}
                      </DropdownMenuItem>
                    ))}
                    {canDelete && (actions.length > 0 || canEdit) && <DropdownMenuSeparator />}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={deletingId === agent.id}
                        onSelect={(e) => { e.preventDefault(); handleDelete(agent); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === agent.id ? '删除中...' : '删除'}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
