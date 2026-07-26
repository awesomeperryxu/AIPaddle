'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api/client';
import {
  ChevronLeft,
  Upload,
  FileText,
  XCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Plus,
  Settings2,
  MoreHorizontal,
  Eye,
  Cpu,
  Globe,
  Lock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type KbDoc = {
  id: string;
  filename: string;
  kbId: string;
  status: string;
  sizeBytes: number;
  createdAt: string;
};

type AgentOpt = { id: string; name: string };
type ChunkConfig = { chunkSize: number; chunkOverlap: number; separator: string };
type RetrievalConfig = { topK: number; scoreThreshold: number; searchMethod: string };
type RetrievedSeg = { documentId: string; filename: string; snippet: string; similarity: number };
type KbVisibility = 'org' | 'restricted';

interface Props {
  kb: {
    id: string;
    name: string;
    description: string;
    status: string;
    visibility: KbVisibility;
    documentCount: number;
    createdAt: string;
  };
  documents: KbDoc[];
  agents: AgentOpt[];
  initialChunkConfig: ChunkConfig;
  initialRetrievalConfig: RetrievalConfig;
  linkedAgentIds: string[];
  canManage: boolean;
}

const STATUS_MAP: Record<string, { label: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:    { label: '可用',   dot: 'bg-green-500',  icon: CheckCircle2 },
  parsing:   { label: '处理中', dot: 'bg-yellow-500', icon: Clock },
  uploading: { label: '上传中', dot: 'bg-blue-400',   icon: Clock },
  error:     { label: '失败',   dot: 'bg-red-500',    icon: AlertCircle },
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function KnowledgeAdminDetailView({
  kb,
  documents: initDocs,
  agents,
  initialChunkConfig,
  initialRetrievalConfig,
  linkedAgentIds: initLinkedIds,
  canManage,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [docs, setDocs] = useState<KbDoc[]>(initDocs);
  const [linkedAgentIds, setLinkedAgentIds] = useState<string[]>(initLinkedIds);
  const [chunkCfg, setChunkCfg] = useState<ChunkConfig>(initialChunkConfig);
  const [retrCfg, setRetrCfg] = useState<RetrievalConfig>(initialRetrievalConfig);

  // 设置 tab
  const [kbName, setKbName] = useState(kb.name);
  const [kbDesc, setKbDesc] = useState(kb.description);
  const [visibility, setVisibility] = useState<KbVisibility>(kb.visibility);

  // 文档列表 UI
  const [docSearch, setDocSearch] = useState('');

  // 召回测试
  const [rQuery, setRQuery] = useState('');
  const [rLoading, setRLoading] = useState(false);
  const [rSegs, setRSegs] = useState<RetrievedSeg[]>([]);
  const [rDone, setRDone] = useState(false);
  const [rHistory, setRHistory] = useState<string[]>([]);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  async function handleUpload(file: File) {
    if (!canManage || busy) return;
    setBusy(true); setMsg('上传中…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kbId', kb.id);
      const upRes = await fetch('/api/documents', { method: 'POST', body: fd });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up?.error?.message ?? '上传失败');
      setMsg('向量化中…');
      await apiFetch(`/api/documents/${up.document.id}/process`, { method: 'POST' });
      flash('已完成');
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : '上传失败');
    } finally { setBusy(false); }
  }

  async function handleDeleteDoc(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      setDocs(d => d.filter(x => x.id !== id));
    } catch (e) {
      flash(e instanceof Error ? e.message : '删除失败');
    } finally { setBusy(false); }
  }

  async function handleReindexDoc(id: string) {
    if (busy) return;
    setBusy(true); setMsg('重新向量化…');
    try {
      await apiFetch(`/api/documents/${id}/process`, { method: 'POST' });
      flash('已触发向量化');
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : '失败');
    } finally { setBusy(false); }
  }

  async function handleReindexAll() {
    if (busy || docs.length === 0) return;
    setBusy(true); setMsg('重新向量化中…');
    try {
      for (const d of docs) {
        await apiFetch(`/api/documents/${d.id}/process`, { method: 'POST' });
      }
      flash('已完成');
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : '失败');
    } finally { setBusy(false); }
  }

  async function saveChunkConfig() {
    if (!canManage || busy) return;
    setBusy(true); setMsg('保存中…');
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ chunkConfig: chunkCfg }),
      });
      flash('切块参数已保存（需重新向量化生效）');
    } catch (e) {
      flash(e instanceof Error ? e.message : '保存失败');
    } finally { setBusy(false); }
  }

  async function saveRetrievalConfig() {
    if (!canManage || busy) return;
    setBusy(true); setMsg('保存中…');
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ retrievalConfig: retrCfg }),
      });
      flash('检索参数已保存');
    } catch (e) {
      flash(e instanceof Error ? e.message : '保存失败');
    } finally { setBusy(false); }
  }

  async function saveKbInfo() {
    if (!canManage || busy) return;
    if (!kbName.trim()) { flash('名称不能为空'); return; }
    setBusy(true); setMsg('保存中…');
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: kbName.trim(), description: kbDesc }),
      });
      flash('已保存');
      router.refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : '保存失败');
    } finally { setBusy(false); }
  }

  async function toggleVisibility(next: KbVisibility) {
    if (!canManage || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility: next }),
      });
      setVisibility(next);
    } catch (e) {
      flash(e instanceof Error ? e.message : '设置失败');
    } finally { setBusy(false); }
  }

  async function toggleAgent(agentId: string) {
    if (!canManage || busy) return;
    const next = linkedAgentIds.includes(agentId)
      ? linkedAgentIds.filter(id => id !== agentId)
      : [...linkedAgentIds, agentId];
    setBusy(true);
    try {
      await apiFetch(`/api/knowledge-bases/${kb.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ agentIds: next }),
      });
      setLinkedAgentIds(next);
    } catch (e) {
      flash(e instanceof Error ? e.message : '设置失败');
    } finally { setBusy(false); }
  }

  async function runRetrieve() {
    const q = rQuery.trim();
    if (!q || rLoading) return;
    setRLoading(true); setRDone(false);
    try {
      const r = await apiFetch<{ segments: RetrievedSeg[] }>('/api/knowledge/retrieve', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          kbId: kb.id,
          topK: retrCfg.topK,
          scoreThreshold: retrCfg.scoreThreshold,
        }),
      });
      setRSegs(r.segments);
      setRHistory(h => [q, ...h.filter(x => x !== q)].slice(0, 5));
    } catch (e) {
      flash(e instanceof Error ? e.message : '检索失败');
      setRSegs([]);
    } finally { setRLoading(false); setRDone(true); }
  }

  const filteredDocs = docs.filter(d =>
    d.filename.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground mt-0.5"
          onClick={() => router.push('/knowledge-admin')}
        >
          <ChevronLeft className="h-4 w-4" />
          知识库
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{kb.name}</h1>
              {kb.description && (
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{kb.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{docs.length} 文档</span>
          <span>·</span>
          <span>创建于 {kb.createdAt}</span>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-foreground">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="documents">
        <TabsList className="mb-6">
          <TabsTrigger value="documents">文档</TabsTrigger>
          <TabsTrigger value="chunk">分段与检索</TabsTrigger>
          <TabsTrigger value="retrieve">召回测试</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        {/* ══════════════════ 文档 ══════════════════ */}
        <TabsContent value="documents" className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索文档…"
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                className="pl-8 h-8 text-sm bg-card border-border"
              />
            </div>
            <div className="flex-1" />
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={busy || docs.length === 0}
                  onClick={handleReindexAll}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  全部重索引
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加文件
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.html,.htm"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { handleUpload(file); e.target.value = ''; }
                  }}
                />
              </>
            )}
          </div>

          {/* 文档列表 */}
          {filteredDocs.length === 0 ? (
            <div
              className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-16 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
              onClick={() => canManage && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && canManage) handleUpload(file);
              }}
            >
              <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                {docSearch ? '没有匹配的文档' : '还没有文档'}
              </p>
              {!docSearch && canManage && (
                <p className="text-xs text-muted-foreground mt-1">
                  拖拽文件到此处，或点击「添加文件」上传
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/20">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">名称</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">大小</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">状态</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">上传时间</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDocs.map((doc, idx) => {
                    const s = STATUS_MAP[doc.status] ?? STATUS_MAP.active;
                    return (
                      <tr key={doc.id} data-testid="kb-doc-row" data-filename={doc.filename}
                        className="hover:bg-muted/10 group">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-xs font-medium text-foreground">{doc.filename}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatSize(doc.sizeBytes)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs" data-testid="kb-doc-status">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            <span className="text-foreground/70">{s.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{doc.createdAt}</td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                title="重新向量化"
                                onClick={() => handleReindexDoc(doc.id)}
                                disabled={busy}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleReindexDoc(doc.id)} disabled={busy}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                    重新向量化
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    disabled={busy}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-2" />
                                    删除文档
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 底部统计 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>{docs.length} 文档</span>
            <span>·</span>
            <span>{docs.filter(d => d.status === 'active').length} 已向量化</span>
            {docs.some(d => d.status === 'parsing' || d.status === 'uploading') && (
              <>
                <span>·</span>
                <span className="text-yellow-500">
                  {docs.filter(d => d.status === 'parsing' || d.status === 'uploading').length} 处理中
                </span>
              </>
            )}
            {docs.some(d => d.status === 'error') && (
              <>
                <span>·</span>
                <span className="text-destructive">
                  {docs.filter(d => d.status === 'error').length} 失败
                </span>
              </>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════ 分段与检索 ══════════════════ */}
        <TabsContent value="chunk" className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            {/* 切块参数 */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4" data-testid="kb-chunk-config">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">分段设置</h3>
              </div>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">分段标识符</span>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={chunkCfg.separator}
                  onChange={e => setChunkCfg(c => ({ ...c, separator: e.target.value }))}
                  disabled={!canManage || busy}
                >
                  <option value={'\n\n'}>空行（段落）</option>
                  <option value={'\n'}>换行</option>
                  <option value={''}>不分段（仅按长度）</option>
                </select>
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">最大长度（字符）</span>
                <Input
                  type="number" min={50} max={4000}
                  value={chunkCfg.chunkSize}
                  onChange={e => setChunkCfg(c => ({ ...c, chunkSize: Number(e.target.value) }))}
                  disabled={!canManage || busy}
                  className="h-9"
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">重叠长度（字符）</span>
                <Input
                  type="number" min={0} max={2000}
                  value={chunkCfg.chunkOverlap}
                  onChange={e => setChunkCfg(c => ({ ...c, chunkOverlap: Number(e.target.value) }))}
                  disabled={!canManage || busy}
                  className="h-9"
                />
              </label>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs w-full"
                    onClick={saveChunkConfig} disabled={busy}>
                    保存分段设置
                  </Button>
                  <p className="text-[11px] text-muted-foreground">修改后需「全部重索引」方可生效。</p>
                </>
              )}
            </div>

            {/* 检索参数 */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4" data-testid="kb-retrieval-config">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">检索设置</h3>
              </div>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">召回数量 (Top K)</span>
                <Input
                  type="number" min={1} max={20}
                  value={retrCfg.topK}
                  onChange={e => setRetrCfg(c => ({ ...c, topK: Number(e.target.value) }))}
                  disabled={!canManage || busy}
                  className="h-9"
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">相似度阈值（0–1）</span>
                <Input
                  type="number" min={0} max={1} step={0.01}
                  value={retrCfg.scoreThreshold}
                  onChange={e => setRetrCfg(c => ({ ...c, scoreThreshold: Number(e.target.value) }))}
                  disabled={!canManage || busy}
                  className="h-9"
                />
              </label>
              <label className="space-y-1.5 block">
                <span className="text-xs text-muted-foreground">检索方式</span>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={retrCfg.searchMethod}
                  onChange={e => setRetrCfg(c => ({ ...c, searchMethod: e.target.value }))}
                  disabled={!canManage || busy}
                >
                  <option value="vector">向量检索（语义）</option>
                  <option value="fulltext" disabled>全文检索（即将支持）</option>
                  <option value="hybrid" disabled>混合检索（即将支持）</option>
                </select>
              </label>
              {canManage && (
                <Button variant="outline" size="sm" className="h-8 text-xs w-full"
                  onClick={saveRetrievalConfig} disabled={busy}>
                  保存检索设置
                </Button>
              )}
            </div>
          </div>

          {/* Agent 授权 */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Agent 权限</h3>
            <p className="text-xs text-muted-foreground">
              {visibility === 'org'
                ? '当前知识库对全员 Agent 开放。可在「设置」中调整可见权限后，再指定授权 Agent。'
                : canManage ? '指定可使用本知识库的 Agent：' : '已授权 Agent：'}
            </p>
            {visibility === 'restricted' && (
              <div className="flex flex-wrap gap-2">
                {agents.length === 0 && (
                  <span className="text-xs text-muted-foreground">暂无已发布 Agent</span>
                )}
                {agents.map(a => {
                  const linked = linkedAgentIds.includes(a.id);
                  return canManage ? (
                    <Button key={a.id} variant={linked ? 'default' : 'outline'}
                      size="sm" className="h-7 text-xs"
                      onClick={() => toggleAgent(a.id)} disabled={busy}>
                      {a.name}
                    </Button>
                  ) : linked ? (
                    <Badge key={a.id} variant="outline">{a.name}</Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════════════ 召回测试 ══════════════════ */}
        <TabsContent value="retrieve">
          <div className="grid grid-cols-2 gap-5 min-h-[420px]">
            {/* 左侧：输入区 + 历史 */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">源文本</h3>
                  <span className="text-xs text-muted-foreground">{rQuery.length}/200</span>
                </div>
                <Textarea
                  placeholder="请输入文本，建议使用简短的陈述句。"
                  value={rQuery}
                  onChange={e => setRQuery(e.target.value.slice(0, 200))}
                  disabled={rLoading}
                  rows={6}
                  className="resize-none text-sm"
                />
                <Button
                  className="w-full"
                  onClick={runRetrieve}
                  disabled={rLoading || !rQuery.trim()}
                >
                  {rLoading ? '检索中…' : '测试'}
                </Button>
              </div>

              {rHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">最近查询</p>
                  {rHistory.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setRQuery(q)}
                      className="block w-full text-left text-xs text-foreground/70 hover:text-foreground truncate px-2 py-1 rounded hover:bg-muted/30 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 右侧：结果区 */}
            <div className="rounded-xl border border-border bg-card p-5">
              {!rDone ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Eye className="h-10 w-10 opacity-20" />
                  <p className="text-sm">召回测试结果将展示在这里</p>
                  <p className="text-xs opacity-60">当前参数：Top K={retrCfg.topK}，阈值={retrCfg.scoreThreshold}</p>
                </div>
              ) : rSegs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Search className="h-10 w-10 opacity-20" />
                  <p className="text-sm">未找到相关内容</p>
                  <p className="text-xs opacity-60">尝试调整问题或降低相似度阈值</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-96">
                  {rSegs.map((seg, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {seg.filename}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {(seg.similarity * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{seg.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════ 设置 ══════════════════ */}
        <TabsContent value="settings" className="space-y-5 max-w-lg">
          <p className="text-xs text-muted-foreground">修改知识库名称、描述及可见权限。</p>

          {/* 基本信息 */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">基本信息</h3>
            <label className="space-y-1.5 block">
              <span className="text-xs text-muted-foreground">名称</span>
              <Input
                value={kbName}
                onChange={e => setKbName(e.target.value)}
                disabled={!canManage || busy}
                className="h-9"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-muted-foreground">描述</span>
              <Textarea
                value={kbDesc}
                onChange={e => setKbDesc(e.target.value)}
                placeholder="描述该知识库的内容，帮助 Agent 决策何时调用"
                disabled={!canManage || busy}
                rows={3}
                className="resize-none text-sm"
              />
            </label>
            {canManage && (
              <Button size="sm" className="h-8 text-xs" onClick={saveKbInfo} disabled={busy}>
                保存
              </Button>
            )}
          </div>

          {/* 可见权限 */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">可见权限</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'org' as KbVisibility, label: '全员可见', desc: '所有 Agent 均可调用', icon: Globe },
                { value: 'restricted' as KbVisibility, label: '受限访问', desc: '仅授权 Agent 可调用', icon: Lock },
              ] as const).map(opt => {
                const Icon = opt.icon;
                const active = visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    disabled={!canManage || busy}
                    onClick={() => toggleVisibility(opt.value)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/10 hover:border-primary/40'
                    } ${!canManage ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {visibility === 'restricted' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {canManage ? '选择可使用本知识库的 Agent：' : '已授权 Agent：'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {agents.length === 0 && (
                    <span className="text-xs text-muted-foreground">暂无已发布 Agent</span>
                  )}
                  {agents.map(a => {
                    const linked = linkedAgentIds.includes(a.id);
                    return canManage ? (
                      <Button key={a.id} variant={linked ? 'default' : 'outline'}
                        size="sm" className="h-7 text-xs"
                        onClick={() => toggleAgent(a.id)} disabled={busy}>
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

          {/* 索引方式 */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">索引方式</h3>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Cpu className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">高质量（向量语义）</p>
                <p className="text-xs text-muted-foreground">使用嵌入模型（text-embedding-v4），支持自然语言语义检索</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
