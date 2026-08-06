'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  GitBranch,
  Play,
  Settings,
  CheckCircle,
  MessageSquare,
  Bot,
  FileText,
  Upload,
  Download,
  MoreHorizontal,
  ChevronRight,
  Trash2,
  Loader2
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

// App types following Dify's structure
type AppType = 'all' | 'workflow' | 'chatflow' | 'agent' | 'text-generation';

interface WorkflowApp {
  id: string;
  name: string;
  description: string;
  type: 'workflow' | 'chatflow' | 'agent' | 'text-generation';
  tags: string[];
  lastEditedAt: string;
  status: 'draft' | 'published' | 'offline';
  executions: number;
  successRate: number;
  hasRuns: boolean;
}

const appTypeConfig = {
  workflow: { label: '工作流', icon: GitBranch, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  chatflow: { label: 'Chatflow', icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
  agent: { label: 'Agent', icon: Bot, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  'text-generation': { label: '文本生成', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10' }
};

const statusConfig = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  published: { label: '已发布', className: 'bg-green-500/10 text-green-500' },
  offline: { label: '已下线', className: 'bg-destructive/10 text-destructive' }
};

export function WorkflowView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<AppType>('all');
  // 个人助理意图跳转（切片2）：?assistant=<描述> → 初始即打开创建应用对话框
  const searchParams = useSearchParams();
  const router = useRouter();
  // WF-1：从个人助理带描述来时，**不再弹创建对话框让用户选类型**——
  // 用户已经把需求说清楚了，再让他点一次 Workflow/Chatflow 是多余的一步；
  // 直接走 copilot/create 一次性建出填好流程的工作流。
  const assistantDesc = searchParams.get('assistant');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // 生成中的整页反馈：此前建壳后才跳编辑器，8s 生成期间画布全空，
  // 用户以为功能没生效（2026-08-06 实测生成耗时 7.7s）
  const [autoGenerating, setAutoGenerating] = useState(!!assistantDesc);
  const [autoGenError, setAutoGenError] = useState<string | null>(null);
  const autoFired = useRef(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── 4.4.1：真实数据接线（列表/创建）───────────────
  const [apps, setApps] = useState<WorkflowApp[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);

  // GX-5：卡片统计取自真实运行聚合（/api/workflows/stats），非硬编码 0。
  type RunStats = { executions: number; successRate: number; lastRunAt: string | null };
  const mapItemToApp = useCallback((w: {
    id: string; name: string; type: 'workflow' | 'chatflow'; status: 'draft' | 'published'; updatedAt?: string;
  }, stats?: RunStats): WorkflowApp => ({
    id: w.id, name: w.name, description: '', type: w.type, tags: [],
    lastEditedAt: w.updatedAt ?? '', status: w.status,
    executions: stats?.executions ?? 0,
    successRate: stats?.successRate ?? 0,
    hasRuns: (stats?.executions ?? 0) > 0,
  }), []);

  useEffect(() => {
    let active = true;
    (async () => {
      type ListItem = { id: string; name: string; type: 'workflow' | 'chatflow'; status: 'draft' | 'published'; updatedAt?: string };
      const [list, statsRes] = await Promise.all([
        apiFetch<{ workflows: ListItem[] }>('/api/workflows').catch(() => ({ workflows: [] as ListItem[] })),
        apiFetch<{ stats: Record<string, RunStats> }>('/api/workflows/stats').catch(() => ({ stats: {} as Record<string, RunStats> })),
      ]);
      if (!active) return;
      setApps((list.workflows ?? []).map((w) => mapItemToApp(w, statsRes.stats?.[w.id])));
      setAppsLoaded(true);
    })();
    return () => { active = false; };
  }, [mapItemToApp]);

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || app.type === selectedType;
    return matchesSearch && matchesType;
  });

  // W1-a：编辑改为跳转到全屏编排编辑器（React Flow 画布接后端），不再用页内 SVG 编辑器。
  const handleEditWorkflow = (app: WorkflowApp) => {
    router.push(`/workflows/${app.id}`);
  };

  // GX-5：导出 DSL —— 走真实端点 GET /api/workflows/[id]/dsl（Content-Disposition 触发下载）。
  const handleExportDsl = (app: WorkflowApp) => {
    const a = document.createElement('a');
    a.href = `/api/workflows/${app.id}/dsl`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // WF-1：助理带描述进来 → 一次调用建出「已填好流程」的工作流，然后直接进编辑器。
  // 全部 setState 落在 promise 链里，不放 effect 同步路径（react-hooks/set-state-in-effect，
  // 与 extensions-view / security-view 同款写法）。
  useEffect(() => {
    if (!assistantDesc || autoFired.current) return;
    autoFired.current = true;
    fetch('/api/workflows/copilot/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: assistantDesc }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error?.message ?? '生成失败');
        return data as { workflow: { id: string }; valid: boolean; validation: unknown[] };
      })
      .then((data) => {
        // 已落库且已校验，编辑器打开即是完整流程——不再带 ?copilot= 二次生成
        router.push(`/workflows/${data.workflow.id}${data.valid ? '' : '?check=1'}`);
      })
      .catch((e) => {
        setAutoGenError(e instanceof Error ? e.message : '生成失败');
        setAutoGenerating(false);
      });
  }, [assistantDesc, router]);

  // 创建空白应用（Workflow / Chatflow）：真实创建后跳转到编排编辑器。
  const handleCreateBlank = async (type: 'workflow' | 'chatflow') => {
    setIsCreateDialogOpen(false);
    const name = type === 'chatflow' ? '新建 Chatflow' : '新建工作流';
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) { showToast('创建失败：无权限或未登录'); return; }
      const { workflow } = await res.json();
      // 从个人助理意图跳转来的（?assistant=<描述>），带描述到编辑页自动触发 Copilot
      const assistantDesc = searchParams.get('assistant');
      const target = assistantDesc
        ? `/workflows/${workflow.id}?copilot=${encodeURIComponent(assistantDesc)}`
        : `/workflows/${workflow.id}`;
      router.push(target);
    } catch { showToast('创建失败：网络错误'); }
  };

  // GX-5 补遗：删除工作流 —— 二次确认 → DELETE 端点（软删）→ 从列表移除。
  // 前端无权限上下文，故菜单始终显示；无权限时由后端 403 兜底并提示。
  const handleDeleteWorkflow = async (app: WorkflowApp) => {
    if (!window.confirm(`确定删除「${app.name}」？删除后将从列表移除。`)) return;
    try {
      const res = await fetch(`/api/workflows/${app.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(`删除失败：${body?.error?.message ?? '无权限或未登录'}`);
        return;
      }
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      showToast('已删除');
    } catch { showToast('删除失败：网络错误'); }
  };

  // 4.4.12：导入 DSL 文件 → 建草稿并进编辑页
  const dslInputRef = useRef<HTMLInputElement>(null);
  const handleImportDsl = async (file: File) => {
    setIsCreateDialogOpen(false);
    try {
      const dsl = JSON.parse(await file.text());
      const res = await fetch('/api/workflows/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dsl),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(`导入失败：${body?.error?.message ?? '格式或权限错误'}`); return; }
      router.push(`/workflows/${body.workflow.id}`);
    } catch { showToast('导入失败：文件不是有效的 DSL JSON'); }
  };

  // WF-1：生成中的整页反馈。生成实测约 8s，没有这个界面用户会以为功能没生效。
  if (autoGenerating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <h2 className="text-lg font-medium text-foreground">正在为你生成工作流…</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              需求：{assistantDesc}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            AI 正在规划节点与连线并做结构校验，通常需要 5–15 秒。完成后会自动打开编辑器。
          </p>
        </div>
      </div>
    );
  }

  if (autoGenError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-lg font-medium text-foreground">生成失败</h2>
          <p className="text-sm text-destructive">{autoGenError}</p>
          <p className="text-xs text-muted-foreground">
            可以把需求描述得更具体些再试，或直接手动创建空白工作流。
          </p>
          <Button variant="outline" onClick={() => { setAutoGenError(null); }}>
            返回工作流列表
          </Button>
        </div>
      </div>
    );
  }

  // Workspace List View (Dify-style)
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工作室</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建和管理 AI 应用工作流</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              创建工作流
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>创建应用</DialogTitle>
              <DialogDescription>选择创建方式开始构建你的 AI 应用</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {/* ① Workflow（批处理 / API） */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => handleCreateBlank('workflow')}
              >
                <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Workflow（批处理 / API）</h3>
                  <p className="text-sm text-muted-foreground">以 End 节点输出，支持 Webhook / 定时 / 插件触发</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              {/* ② Chatflow（对话场景） */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => handleCreateBlank('chatflow')}
              >
                <div className="w-11 h-11 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Chatflow（对话场景）</h3>
                  <p className="text-sm text-muted-foreground">以 Answer 节点流式输出，支持多轮上下文与对话变量</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              {/* ③ 导入 DSL 文件 */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => dslInputRef.current?.click()}
              >
                <input
                  ref={dslInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportDsl(f);
                    e.target.value = '';
                  }}
                />
                <div className="w-11 h-11 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-teal-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">导入 DSL 文件</h3>
                  <p className="text-sm text-muted-foreground">导入 .aipaddle.json（DSL）重建工作流</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </div>
            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">拖放 DSL（.yml）文件到此处创建应用</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Type Filter Tabs */}
      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as AppType)} className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              工作流
            </TabsTrigger>
            <TabsTrigger value="chatflow" className="text-xs gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chatflow
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Agent
            </TabsTrigger>
            <TabsTrigger value="text-generation" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              文本生成
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索应用..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-card border-border"
            />
          </div>
        </div>

        {/* Apps Grid */}
        <TabsContent value={selectedType} className="mt-5">
          {/* 加载中 / 空态（去除 mock 闪现：只渲染真实数据） */}
          {!appsLoaded && (
            <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
          )}
          {appsLoaded && filteredApps.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <GitBranch className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchTerm || selectedType !== 'all' ? '没有匹配的工作流' : '还没有工作流'}
              </p>
              {!searchTerm && selectedType === 'all' && (
                <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  创建工作流
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => {
              const typeConfig = appTypeConfig[app.type];
              return (
                <Card
                  key={app.id}
                  className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => handleEditWorkflow(app)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig.bg} flex items-center justify-center`}>
                          <typeConfig.icon className={`h-5 w-5 ${typeConfig.color}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{app.name}</h3>
                          <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditWorkflow(app); }}>
                            <Settings className="h-4 w-4 mr-2" />
                            设置
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExportDsl(app); }}>
                            <Download className="h-4 w-4 mr-2" />
                            导出 DSL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); void handleDeleteWorkflow(app); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[40px]">
                      {app.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {app.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                          {tag}
                        </Badge>
                      ))}
                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <Plus className="h-3 w-3 mr-0.5" />
                        添加标签
                      </Button>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {app.lastEditedAt && <span>编辑于 {app.lastEditedAt}</span>}
                      </div>
                      <Badge className={statusConfig[app.status].className}>
                        {statusConfig[app.status].label}
                      </Badge>
                    </div>

                    {/* Stats（GX-5：真实运行聚合；从未运行显示 0 / — 成功率） */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {app.executions.toLocaleString()} 次执行
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {app.hasRuns ? `${app.successRate}% 成功率` : '— 成功率'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Toast 提示（原型模拟反馈） */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[400] flex items-center gap-2 rounded-lg border border-green-500/40 bg-card px-4 py-3 shadow-2xl">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-[13px] text-foreground">{toast}</span>
        </div>
      )}
    </div>
  );
}
