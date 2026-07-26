'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { KnowledgeBase } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import {
  Plus,
  Search,
  RefreshCw,
  FolderOpen,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  MoreHorizontal,
  Settings,
  Trash2,
  Database,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_CONFIG = {
  processing: { label: '处理中', className: 'bg-yellow-500/10 text-yellow-500 border-0', icon: Clock },
  completed: { label: '已完成', className: 'bg-green-500/10 text-green-500 border-0', icon: CheckCircle2 },
  failed: { label: '失败', className: 'bg-destructive/10 text-destructive border-0', icon: XCircle },
};

type KbVisibility = 'org' | 'restricted';
type KbView = KnowledgeBase & { visibility?: KbVisibility };
type DocRef = { id: string; kbId: string };

export function KnowledgeAdminView({
  knowledgeBases = [],
  documents = [],
  canManage = false,
}: {
  knowledgeBases?: KbView[];
  documents?: DocRef[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleReindex(kb: KbView) {
    if (busy) return;
    const kbDocs = documents.filter(d => d.kbId === kb.id);
    if (kbDocs.length === 0) { window.alert('该知识库暂无文档'); return; }
    if (!window.confirm(`对「${kb.name}」的 ${kbDocs.length} 个文档重新向量化？`)) return;
    setBusy(true);
    try {
      for (const d of kbDocs) {
        await apiFetch(`/api/documents/${d.id}/process`, { method: 'POST' });
      }
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '重新向量化失败');
    } finally { setBusy(false); }
  }

  async function handleDelete(kb: KbView) {
    if (busy) return;
    if (!window.confirm(`确定删除「${kb.name}」？文档与向量将一并移除。`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    } finally { setBusy(false); }
  }

  const totalDocs = knowledgeBases.reduce((sum, kb) => sum + kb.documents, 0);
  const completedCount = knowledgeBases.filter(kb => kb.vectorStatus === 'completed').length;
  const processingCount = knowledgeBases.filter(kb => kb.vectorStatus === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">知识库</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理企业文档，为 Agent 提供知识支撑</p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => router.push('/knowledge-admin/new')}>
            <Plus className="h-4 w-4" />
            创建知识库
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '知识库数量', value: knowledgeBases.length, icon: Database, color: 'text-primary', bg: 'bg-primary/10' },
          { label: '总文档数', value: totalDocs, icon: FileText, color: 'text-chart-2', bg: 'bg-chart-2/10' },
          { label: '已向量化', value: completedCount, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: '处理中', value: processingCount, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索知识库..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Grid */}
      {filteredKBs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">
            {searchTerm ? '没有匹配的知识库' : '还没有知识库，点击「创建知识库」开始'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKBs.map(kb => {
            const StatusIcon = STATUS_CONFIG[kb.vectorStatus].icon;
            return (
              <Card
                key={kb.id}
                data-testid="kb-card"
                data-kb-name={kb.name}
                className="bg-card border-border cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm group"
                onClick={() => router.push(`/knowledge-admin/${kb.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-medium text-foreground truncate">{kb.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 -mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={e => { e.stopPropagation(); router.push(`/knowledge-admin/${kb.id}`); }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              打开详情
                            </DropdownMenuItem>
                            {canManage && (
                              <DropdownMenuItem
                                disabled={busy}
                                onClick={e => { e.stopPropagation(); handleReindex(kb); }}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                重新向量化
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  disabled={busy}
                                  onClick={e => { e.stopPropagation(); handleDelete(kb); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除知识库
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{kb.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {kb.documents} 文档
                      </span>
                      <span>{kb.size}</span>
                    </div>
                    <Badge className={STATUS_CONFIG[kb.vectorStatus].className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {STATUS_CONFIG[kb.vectorStatus].label}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-2">更新于 {kb.lastUpdated}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
