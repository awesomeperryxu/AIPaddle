'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { KnowledgeBase } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Search,
  Upload,
  Database,
  FileText,
  FolderOpen,
  Settings,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  processing: { label: '处理中', className: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  completed: { label: '已完成', className: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  failed: { label: '失败', className: 'bg-destructive/10 text-destructive', icon: XCircle }
};

type KbDoc = { id: string; filename: string; kbId: string; status: string; createdAt: string };
type KbVisibility = 'org' | 'restricted';
type KbView = KnowledgeBase & { visibility?: KbVisibility };
type AgentOpt = { id: string; name: string };

export function KnowledgeAdminView({
  knowledgeBases = [],
  documents = [],
  agents = [],
  canManage = false,
}: {
  knowledgeBases?: KbView[];
  documents?: KbDoc[];
  agents?: AgentOpt[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKB, setSelectedKB] = useState<KbView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [linkedAgentIds, setLinkedAgentIds] = useState<string[]>([]);

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const kbDocs = selectedKB ? documents.filter(d => d.kbId === selectedKB.id) : [];

  // 选中知识库：同时拉取其关联 Agent（4.2.8 权限范围）
  async function selectKb(kb: KbView) {
    setSelectedKB(kb);
    setLinkedAgentIds([]);
    try {
      const r = await apiFetch<{ agents: { agentId: string }[] }>(`/api/knowledge-bases/${kb.id}`);
      setLinkedAgentIds(r.agents.map(a => a.agentId));
    } catch { /* 忽略拉取失败 */ }
  }

  async function handleToggleVisibility() {
    if (!selectedKB || busy) return;
    const next: KbVisibility = selectedKB.visibility === 'restricted' ? 'org' : 'restricted';
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge-bases/${selectedKB.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility: next }),
      });
      setSelectedKB({ ...selectedKB, visibility: next });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '设置失败');
    } finally { setBusy(false); }
  }

  async function handleToggleAgent(agentId: string) {
    if (!selectedKB || busy) return;
    const next = linkedAgentIds.includes(agentId)
      ? linkedAgentIds.filter(id => id !== agentId)
      : [...linkedAgentIds, agentId];
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge-bases/${selectedKB.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ agentIds: next }),
      });
      setLinkedAgentIds(next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '设置失败');
    } finally { setBusy(false); }
  }

  async function handleUpload(file: File) {
    if (!selectedKB || busy) return;
    setBusy(true); setMsg('上传中…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kbId', selectedKB.id);
      const upRes = await fetch('/api/documents', { method: 'POST', body: fd });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up?.error?.message ?? '上传失败');
      setMsg('向量化中…');
      await apiFetch(`/api/documents/${up.document.id}/process`, { method: 'POST' });
      setMsg('已完成');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  async function handleDeleteDoc(id: string) {
    if (busy || !window.confirm('确定删除该文档？')) return;
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally { setBusy(false); }
  }

  async function handleCreateKb() {
    const name = window.prompt('知识库名称？');
    if (!name?.trim() || busy) return;
    setBusy(true);
    try {
      await apiFetch('/api/knowledge-bases', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 ${selectedKB ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">知识库管理</h1>
            <p className="text-muted-foreground">管理企业知识文档</p>
          </div>
          {canManage && (
            <Button className="gap-2" onClick={handleCreateKb} disabled={busy}>
              <Plus className="h-4 w-4" />
              创建知识库
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{knowledgeBases.length}</p>
                  <p className="text-xs text-muted-foreground">知识库数量</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{knowledgeBases.reduce((acc, kb) => acc + kb.documents, 0)}</p>
                  <p className="text-xs text-muted-foreground">总文档数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{knowledgeBases.filter(kb => kb.vectorStatus === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">已完成向量化</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{knowledgeBases.filter(kb => kb.vectorStatus === 'processing').length}</p>
                  <p className="text-xs text-muted-foreground">处理中</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识库..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Knowledge Base List */}
        <div className="space-y-4">
          {filteredKBs.map((kb) => {
            const StatusIcon = statusConfig[kb.vectorStatus].icon;
            return (
              <Card
                key={kb.id}
                data-testid="kb-card"
                data-kb-name={kb.name}
                className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                  selectedKB?.id === kb.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => selectKb(kb)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">{kb.name}</h3>
                        <Badge className={statusConfig[kb.vectorStatus].className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[kb.vectorStatus].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{kb.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {kb.documents} 文档
                        </span>
                        <span>{kb.size}</span>
                        <span>更新于 {kb.lastUpdated}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem>
                          <Upload className="h-4 w-4 mr-2" />
                          上传文档
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          重新向量化
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          设置
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          删除知识库
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Knowledge Base Detail */}
      {selectedKB && (
        <div className="w-[420px] space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">{selectedKB.name}</CardTitle>
                  <CardDescription>{selectedKB.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{selectedKB.documents}</p>
                  <p className="text-xs text-muted-foreground">文档数量</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{selectedKB.size}</p>
                  <p className="text-xs text-muted-foreground">存储大小</p>
                </div>
              </div>

              {/* Vector Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">向量化状态</h4>
                  <Badge className={statusConfig[selectedKB.vectorStatus].className}>
                    {statusConfig[selectedKB.vectorStatus].label}
                  </Badge>
                </div>
                {selectedKB.vectorStatus === 'processing' ? (
                  <div className="space-y-2">
                    <Progress value={65} className="h-2" />
                    <p className="text-xs text-muted-foreground">正在处理: 技术架构文档.pdf (65%)</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">所有文档已完成向量化处理</p>
                )}
              </div>

              {/* Documents */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">最近文档</h4>
                <div className="space-y-2">
                  {kbDocs.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无文档，点下方「上传文档」添加</p>
                  )}
                  {kbDocs.map((doc) => (
                    <div
                      key={doc.id}
                      data-testid="kb-doc-row"
                      data-filename={doc.filename}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <span className="flex items-center gap-2 min-w-0 text-sm text-foreground">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.filename}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0" data-testid="kb-doc-status">
                          {doc.status}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="查看文档">
                          <Eye className="h-3 w-3" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label="删除文档"
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={busy}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permissions（4.2.8 权限范围）*/}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">权限范围</h4>
                  {canManage && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleToggleVisibility} disabled={busy}>
                      切换为{selectedKB.visibility === 'restricted' ? '全员可见' : '受限'}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={selectedKB.visibility === 'restricted' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}>
                    {selectedKB.visibility === 'restricted' ? '受限（仅关联 Agent）' : '全员可访问'}
                  </Badge>
                </div>

                {selectedKB.visibility === 'restricted' && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {canManage ? '勾选可使用本知识库的 Agent：' : '可使用本知识库的 Agent：'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {agents.length === 0 && <span className="text-xs text-muted-foreground">暂无 Agent</span>}
                      {agents.map((a) => {
                        const linked = linkedAgentIds.includes(a.id);
                        return canManage ? (
                          <Button
                            key={a.id}
                            variant={linked ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => handleToggleAgent(a.id)}
                            disabled={busy}
                          >
                            {a.name}
                          </Button>
                        ) : linked ? (
                          <Badge key={a.id} variant="outline">{a.name}</Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  aria-label="上传文件"
                  data-testid="kb-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex gap-2">
                  {canManage && (
                    <Button className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
                      <Upload className="h-4 w-4 mr-2" />
                      {busy ? '处理中…' : '上传文档'}
                    </Button>
                  )}
                  <Button variant="outline" className={canManage ? '' : 'flex-1'}>
                    <Eye className="h-4 w-4 mr-2" />
                    测试召回
                  </Button>
                </div>
                {msg && <p className="text-xs text-center text-muted-foreground" data-testid="kb-upload-msg">{msg}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Supported Formats */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm text-foreground">支持的文档格式</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['PDF', 'Word', 'Excel', 'Markdown', 'TXT', 'HTML'].map((format) => (
                  <Badge key={format} variant="outline" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
