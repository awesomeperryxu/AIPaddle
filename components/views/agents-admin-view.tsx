'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Bot,
  Plus,
  Search,
  Settings,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Zap,
  Database,
  GitBranch,
  MessageSquare,
  Copy,
  Phone,
  MessagesSquare,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  pending: { label: '待审核', className: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  published: { label: '已发布', className: 'bg-success/10 text-success', dot: 'bg-success' },
  offline: { label: '已下线', className: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' }
};

// Usage scenarios configuration
const usageScenarios = [
  { 
    id: 'local-cc', 
    name: '本地CC', 
    icon: Phone, 
    description: '本地呼叫中心集成',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  { 
    id: 'wecom', 
    name: '企微对话', 
    icon: MessagesSquare, 
    description: '企业微信对话接入',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10'
  },
  { 
    id: 'web', 
    name: 'Web 接入', 
    icon: Globe, 
    description: '网页端嵌入式对话',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  },
  { 
    id: 'api', 
    name: 'API 调用', 
    icon: Zap, 
    description: '通过 API 直接调用',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10'
  },
];

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
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // 调用日志（4.1.5）：选中 Agent 时拉取真实日志
  type CallLogItem = { id: string; model: string | null; tokensIn: number; tokensOut: number; success: boolean; createdAt: string };
  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [logCount, setLogCount] = useState<number | null>(null);

  async function selectForDetail(agent: Agent) {
    setSelectedAgent(agent);
    setLogs([]);
    setLogCount(null);
    try {
      const res = await apiFetch<{ logs: CallLogItem[]; count: number }>(`/api/agents/${agent.id}/logs`);
      setLogs(res.logs);
      setLogCount(res.count);
    } catch {
      // 无 audit:read 权限或空 → 静默
    }
  }

  // 创建 Agent 弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // AI 帮我建（Copilot，4.1.6）
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotDesc, setCopilotDesc] = useState('');
  const [copiloting, setCopiloting] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  async function handleCopilot() {
    if (copilotDesc.trim().length < 4) {
      setCopilotError('请多描述一点需求');
      return;
    }
    setCopiloting(true);
    setCopilotError(null);
    try {
      await apiFetch('/api/agents/copilot', { method: 'POST', body: JSON.stringify({ description: copilotDesc }) });
      setCopilotOpen(false);
      setCopilotDesc('');
      router.refresh(); // 生成的草稿出现在列表（draft 态）
    } catch (e) {
      setCopilotError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setCopiloting(false);
    }
  }

  // 编辑 Agent 弹窗
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', department: '', description: '' });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 删除 Agent（软删除）
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openEdit(agent: Agent) {
    setEditForm({ name: agent.name, department: agent.department, description: agent.description });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!selectedAgent) return;
    if (!editForm.name.trim()) {
      setEditError('名称不能为空');
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      await apiFetch(`/api/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setEditOpen(false);
      setSelectedAgent({ ...selectedAgent, ...editForm });
      router.refresh(); // 重新从服务端拉取，刷新后仍在
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete(agent: Agent) {
    if (deletingId) return;
    if (!window.confirm(`确定删除 Agent「${agent.name}」？删除后可在回收站找回（软删除）。`)) return;
    setDeletingId(agent.id);
    try {
      await apiFetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      router.refresh(); // 重新从服务端拉取列表，删除项消失
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  // 状态机流转（4.1.2）
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // 按当前状态 + 用户权限，算出该 Agent 可用的流转动作
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
      await apiFetch(`/api/agents/${agent.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      router.refresh(); // 刷新列表，状态更新
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setTransitioningId(null);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setCreateError('名称不能为空');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(form) });
      setCreateOpen(false);
      setForm({ name: '', department: '', description: '' });
      router.refresh(); // 重新从服务端拉取列表，刷新后数据仍在
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.department.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && agent.status === activeTab;
  });

  const stats = {
    total: agents.length,
    published: agents.filter(a => a.status === 'published').length,
    pending: agents.filter(a => a.status === 'pending').length,
    draft: agents.filter(a => a.status === 'draft').length,
  };

  return (
    <div className="flex h-full gap-6">
      {/* Agent List */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedAgent ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Agent 管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">创建、配置和管理 AI Agent</p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setCopilotOpen(true)}>
                <Zap className="h-4 w-4" />
                AI 帮我建
              </Button>
              <Button className="gap-2 shadow-sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                创建 Agent
              </Button>
            </div>
          )}
        </div>

        {/* AI 帮我建（Copilot，4.1.6）*/}
        <Dialog open={copilotOpen} onOpenChange={setCopilotOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI 帮我建 Agent</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">描述你想要的 Agent，AI 生成配置草稿（草稿态，发布仍需走审核）。</p>
            {copilotError && <p className="text-sm text-red-500">{copilotError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="copilot-desc">需求描述</Label>
              <Input
                id="copilot-desc"
                value={copilotDesc}
                onChange={e => setCopilotDesc(e.target.value)}
                placeholder="例如：一个处理客户售后投诉的客服助手，语气耐心专业"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCopilot} disabled={copiloting}>
                {copiloting ? 'AI 生成中...' : '生成草稿'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 Agent</DialogTitle>
            </DialogHeader>
            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">名称</Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Agent 名称"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-dept">部门</Label>
                <Input
                  id="agent-dept"
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  placeholder="所属部门"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑 Agent</DialogTitle>
            </DialogHeader>
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-agent-name">名称</Label>
                <Input
                  id="edit-agent-name"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Agent 名称"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-agent-dept">部门</Label>
                <Input
                  id="edit-agent-dept"
                  value={editForm.department}
                  onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="所属部门"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-agent-desc">描述</Label>
                <Input
                  id="edit-agent-desc"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Agent 描述"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEdit} disabled={editing}>
                {editing ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">全部</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.published}</p>
                  <p className="text-xs text-muted-foreground">已发布</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">待审核</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.draft}</p>
                  <p className="text-xs text-muted-foreground">草稿</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Tabs */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Agent 名称或部门..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/50 h-9">
              <TabsTrigger value="all" className="text-xs px-3">全部</TabsTrigger>
              <TabsTrigger value="published" className="text-xs px-3">已发布</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs px-3">待审核</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-3">草稿</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
                selectedAgent?.id === agent.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
              }`}
              onClick={() => selectForDetail(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl shrink-0">
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">{agent.name}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {agent.department}
                      </Badge>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[agent.status].dot}`} />
                        <span className="text-xs text-muted-foreground">{statusConfig[agent.status].label}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{agent.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {agent.model}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {agent.calls.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {agent.successRate}%
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        配置
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Play className="h-4 w-4 mr-2" />
                        调试
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        复制
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {availableActions(agent).map(action => (
                        <DropdownMenuItem
                          key={action}
                          disabled={transitioningId === agent.id}
                          onSelect={(e) => {
                            e.preventDefault();
                            handleTransition(agent, action);
                          }}
                        >
                          {action === 'offline' ? (
                            <Pause className="h-4 w-4 mr-2" />
                          ) : action === 'reject' ? (
                            <XCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {transitioningId === agent.id ? '处理中...' : ACTION_LABEL[action]}
                        </DropdownMenuItem>
                      ))}
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={deletingId === agent.id}
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDelete(agent);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deletingId === agent.id ? '删除中...' : '删除'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <div className="w-[420px] flex flex-col gap-4 overflow-y-auto">
          {/* Basic Info */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
                    {selectedAgent.avatar}
                  </div>
                  <div>
                    <CardTitle className="text-base text-foreground">{selectedAgent.name}</CardTitle>
                    <CardDescription className="text-xs">{selectedAgent.department}</CardDescription>
                  </div>
                </div>
                <Badge className={statusConfig[selectedAgent.status].className}>
                  {statusConfig[selectedAgent.status].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedAgent.description}</p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-0.5">总调用量{logCount !== null ? '（实时）' : ''}</p>
                  <p className="text-base font-semibold text-foreground">{(logCount ?? selectedAgent.calls).toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-0.5">成功率</p>
                  <p className="text-base font-semibold text-foreground">{selectedAgent.successRate}%</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-0.5">Token 消耗</p>
                  <p className="text-base font-semibold text-foreground">{(selectedAgent.tokenUsage / 1000000).toFixed(2)}M</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-0.5">创建日期</p>
                  <p className="text-base font-semibold text-foreground">{selectedAgent.createdAt}</p>
                </div>
              </div>

              {/* 调用日志（4.1.5，真实） */}
              {logs.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">最近调用</p>
                  <div className="space-y-1">
                    {logs.slice(0, 5).map(log => (
                      <div key={log.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-muted/40">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.success ? 'bg-success' : 'bg-destructive'}`} />
                          <span className="text-muted-foreground">{log.model ?? '—'}</span>
                        </span>
                        <span className="text-muted-foreground">↑{log.tokensIn} ↓{log.tokensOut} tokens</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Scenarios - 使用场景 */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">使用场景</CardTitle>
              <CardDescription className="text-xs">配置 Agent 的接入渠道</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {usageScenarios.map((scenario) => {
                  const Icon = scenario.icon;
                  const isEnabled = scenario.id === 'local-cc' || scenario.id === 'wecom';
                  return (
                    <button
                      key={scenario.id}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        isEnabled 
                          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' 
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-7 h-7 rounded-md ${scenario.bgColor} flex items-center justify-center`}>
                          <Icon className={`h-3.5 w-3.5 ${scenario.color}`} />
                        </div>
                        <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                        {isEnabled && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{scenario.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">配置信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">模型</span>
                </div>
                <span className="text-sm text-muted-foreground">{selectedAgent.model}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">知识库</span>
                </div>
                <span className="text-sm text-muted-foreground">2 个已绑定</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Skill</span>
                </div>
                <span className="text-sm text-muted-foreground">5 个已绑定</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">工作流</span>
                </div>
                <span className="text-sm text-muted-foreground">1 个已绑定</span>
              </div>
            </CardContent>
          </Card>

          {/* API Token */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">API Token</CardTitle>
              <CardDescription className="text-xs">用于外部系统调用此 Agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-muted text-xs text-muted-foreground font-mono truncate">
                  ap_sk_live_xxxxxxxxxxxxxxxxxxxxx
                </code>
                <Button variant="outline" size="sm" className="h-8 px-2">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 shadow-sm"
              disabled={!canEdit}
              onClick={() => selectedAgent && openEdit(selectedAgent)}
            >
              <Settings className="h-4 w-4 mr-2" />
              编辑配置
            </Button>
            <Button variant="outline" className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              调试测试
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
