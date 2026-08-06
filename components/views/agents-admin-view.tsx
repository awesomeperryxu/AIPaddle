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
import type { AgentReadiness } from '@/lib/agents/readiness';
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
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 彩色首字 Avatar（确定性颜色 by 名称首字）
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-orange-400',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-500',
];
function getAvatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// 状态样式（原型设计：已发布 pill 背景，草稿纯文字）
const statusConfig = {
  draft:     { label: '草稿',   dotClass: 'bg-muted-foreground', pillClass: 'text-muted-foreground' },
  pending:   { label: '待审核', dotClass: 'bg-amber-500',        pillClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  published: { label: '已发布', dotClass: 'bg-green-500',        pillClass: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  offline:   { label: '已下线', dotClass: 'bg-destructive',      pillClass: 'text-destructive bg-destructive/10' },
};


export function AgentsAdminView({
  agents = [],
  readiness = {},
  canCreate = false,
  canDelete = false,
  canEdit = false,
  canSubmit = false,
  canReview = false,
}: {
  agents?: Agent[];
  /** 配置完整度（按 agentId）。外部导入的 Agent 常只有提示词、没有能力接线 */
  readiness?: Record<string, AgentReadiness>;
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

  // AI 帮我建（Copilot，4.1.6）；?assistant=<描述> → 自动打开并预填
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

  // 创建空白 Agent（4.1.13a）：直接以默认名建草稿 → 进编排页改名
  const [creating, setCreating] = useState(false);
  async function handleCreateBlank() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiFetch<{ agent: { id: string } }>('/api/agents', {
        method: 'POST',
        body: JSON.stringify({ name: '未命名 Agent' }),
      });
      if (res?.agent?.id) router.push(`/agents-admin/${res.agent.id}`);
      else router.refresh();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : '创建失败');
      setCreating(false);
    }
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
      // 用页内提示而非 window.alert：alert 的文案不进 DOM，用户无法复制、
      // e2e 也断言不到（S1-CRUD-04 一直挂在这），且与本页其它提示不一致
      showNotice(e instanceof Error ? e.message : '删除失败');
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

  const departments = [...new Set(agents.map(a => a.department).filter(Boolean))].sort()
  const isDeptTab = departments.includes(activeTab)
  const filteredAgents = agents.filter(agent => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.department ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.description ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    if (isDeptTab) return matchesSearch && agent.department === activeTab;
    if (activeTab !== 'all') return matchesSearch && agent.status === activeTab;
    return matchesSearch;
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
              <Button className="gap-1.5 shadow-sm" disabled={creating}>
                <Plus className="h-4 w-4" />
                {creating ? '创建中...' : '创建 Agent'}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setCopilotOpen(true)}>
                <Zap className="h-4 w-4 mr-2 text-primary" />
                AI 帮我建
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateBlank} disabled={creating}>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑 Agent</DialogTitle></DialogHeader>
          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">名称</Label>
              <Input id="edit-name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept">部门</Label>
              <Input id="edit-dept" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">描述</Label>
              <Input id="edit-desc" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
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

      {/* ── Search + Status Tabs ── */}
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

      {/* ── 分类标签栏 ── */}
      {departments.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
          >全部 {agents.length}</button>
          {departments.map(d => (
            <button key={d} onClick={() => setActiveTab(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === d ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            >{d} {agents.filter(a => a.department === d).length}</button>
          ))}
        </div>
      )}

      {/* ── Agent 卡片网格 ── */}
      <div className="flex-1 overflow-y-auto">
        {filteredAgents.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">暂无 Agent</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAgents.map((agent) => {
              const sc = statusConfig[agent.status] ?? statusConfig.draft;
              const actions = availableActions(agent);
              const [profession, desc] = (agent.description ?? '').includes('：')
                ? [agent.description.split('：')[0], agent.description.split('：').slice(1).join('：')]
                : ['', agent.description ?? ''];
              return (
                <div key={agent.id}
                  className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col"
                  onClick={() => router.push(`/agents-admin/${agent.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${getAvatarBg(agent.name)}`}>
                      {agent.name.charAt(0)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.pillClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dotClass}`} />{sc.label}
                      </div>
                      {(actions.length > 0 || canDelete || canEdit) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => e.stopPropagation()}><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40" onClick={e => e.stopPropagation()}>
                            {canEdit && <DropdownMenuItem onClick={() => openEdit(agent)}><Settings className="h-4 w-4 mr-2" />编辑信息</DropdownMenuItem>}
                            {actions.map(a => (
                              <DropdownMenuItem key={a} disabled={transitioningId === agent.id}
                                onSelect={e => { e.preventDefault(); handleTransition(agent, a); }}>
                                {a === 'offline' ? <Pause className="h-4 w-4 mr-2" /> : a === 'reject' ? <XCircle className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                {transitioningId === agent.id ? '处理中...' : ACTION_LABEL[a]}
                              </DropdownMenuItem>
                            ))}
                            {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" disabled={deletingId === agent.id}
                              onSelect={e => { e.preventDefault(); handleDelete(agent); }}>
                              <Trash2 className="h-4 w-4 mr-2" />{deletingId === agent.id ? '删除中...' : '删除'}
                            </DropdownMenuItem></>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-1">{agent.name}</h3>
                  {profession && <span className="text-xs text-primary/80 font-medium mb-1.5">{profession}</span>}
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-3">{desc || '暂无描述'}</p>

                  {/* 配置缺口提示：外部平台导入的 Agent 只搬得动提示词，能力接线搬不过来，
                      不在列表标出来就要点进去才发现是空壳（曾 133 个里 89 个空壳且全是已发布） */}
                  {(() => {
                    const r = readiness[agent.id];
                    if (!r || r.gaps.length === 0) return null;
                    const blocking = r.gaps.filter((g) => g.severity === 'blocking');
                    const tone = blocking.length
                      ? 'bg-destructive/5 border-destructive/20 text-destructive'
                      : 'bg-amber-500/5 border-amber-500/20 text-amber-600';
                    return (
                      <div className={`mb-3 rounded-lg border px-2.5 py-2 ${tone}`}
                        title={r.gaps.map((g) => `${g.label}：${g.hint}`).join('\n')}>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {r.isShell ? '未配置能力，当前仅裸 LLM 对话' : `待配置：${r.gaps.map((g) => g.label).join('、')}`}
                        </div>
                        <p className="mt-0.5 text-[10px] leading-snug opacity-80 line-clamp-2">
                          {r.gaps[0].hint}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    {agent.department ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{agent.department}</span> : <span />}
                    <span className="text-[10px] text-muted-foreground">{agent.calls > 0 ? `${agent.calls.toLocaleString()} 次调用` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
