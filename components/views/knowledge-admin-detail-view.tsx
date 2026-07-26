'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Eye,
  Search,
} from 'lucide-react';

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

const STATUS_MAP: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: '已就绪', className: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  parsing: { label: '处理中', className: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  uploading: { label: '上传中', className: 'bg-blue-500/10 text-blue-400', icon: Clock },
  error: { label: '失败', className: 'bg-destructive/10 text-destructive', icon: AlertCircle },
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
  const [visibility, setVisibility] = useState<KbVisibility>(kb.visibility);

  // 检索测试
  const [rQuery, setRQuery] = useState('');
  const [rLoading, setRLoading] = useState(false);
  const [rSegs, setRSegs] = useState<RetrievedSeg[]>([]);
  const [rDone, setRDone] = useState(false);

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

  async function toggleVisibility() {
    if (!canManage || busy) return;
    const next: KbVisibility = visibility === 'restricted' ? 'org' : 'restricted';
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
    } catch (e) {
      flash(e instanceof Error ? e.message : '检索失败');
      setRSegs([]);
    } finally { setRLoading(false); setRDone(true); }
  }

  const done = docs.filter(d => d.status === 'active').length;
  const failed = docs.filter(d => d.status === 'error').length;
  const processing = docs.filter(d => d.status === 'parsing' || d.status === 'uploading').length;
  const pct = docs.length === 0 ? 0 : Math.round((done / docs.length) * 100);

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
          返回
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{kb.name}</h1>
            <Badge
              className={
                kb.status === 'active'
                  ? 'bg-green-500/10 text-green-500 border-0'
                  : 'bg-yellow-500/10 text-yellow-500 border-0'
              }
            >
              {kb.status === 'active' ? '正常' : '处理中'}
            </Badge>
          </div>
          {kb.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{kb.description}</p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{docs.length} 个文档</p>
          <p className="mt-0.5">创建于 {kb.createdAt}</p>
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
          <TabsTrigger value="documents">文档管理</TabsTrigger>
          <TabsTrigger value="settings">切块与检索设置</TabsTrigger>
          <TabsTrigger value="retrieve">检索测试</TabsTrigger>
        </TabsList>

        {/* === 文档管理 === */}
        <TabsContent value="documents" className="space-y-5">
          {/* 向量化进度 */}
          {docs.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">向量化进度</span>
                <span className="text-xs text-muted-foreground">{done}/{docs.length} 完成</span>
              </div>
              <Progress value={pct} className="h-2" />
              {(processing > 0 || failed > 0) && (
                <p className="text-xs text-muted-foreground">
                  {processing > 0 && `处理中 ${processing} 个`}
                  {processing > 0 && failed > 0 && '，'}
                  {failed > 0 && <span className="text-destructive">失败 {failed} 个</span>}
                </p>
              )}
            </div>
          )}

          {/* 上传区 */}
          {canManage && (
            <div
              className="rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-colors p-8 text-center cursor-pointer"
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleUpload(file);
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">拖拽文件到此处，或点击选择</p>
              <p className="text-xs text-muted-foreground mt-1">
                支持 PDF、Word、Excel、PPT、TXT、Markdown（单次一个文件）
              </p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.html"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { handleUpload(file); e.target.value = ''; }
                }}
              />
            </div>
          )}

          {/* 操作栏 */}
          {docs.length > 0 && canManage && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleReindexAll}
                disabled={busy}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                全部重新向量化
              </Button>
            </div>
          )}

          {/* 文档列表 */}
          {docs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无文档，上传第一个文件开始构建知识库</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">文件名</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">大小</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">状态</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">上传时间</th>
                    {canManage && <th className="w-16" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {docs.map(doc => {
                    const s = STATUS_MAP[doc.status] ?? STATUS_MAP.active;
                    const SIcon = s.icon;
                    return (
                      <tr key={doc.id} data-testid="kb-doc-row" data-filename={doc.filename} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-xs">{doc.filename}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatSize(doc.sizeBytes)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={`${s.className} border-0 text-[10px] gap-1`}
                            data-testid="kb-doc-status"
                          >
                            <SIcon className="h-3 w-3" />
                            {s.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{doc.createdAt}</td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="查看文档">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                aria-label="删除文档"
                                onClick={() => handleDeleteDoc(doc.id)}
                                disabled={busy}
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === 切块与检索设置 === */}
        <TabsContent value="settings" className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            {/* 切块参数 */}
            <div
              className="rounded-xl border border-border bg-card p-5 space-y-4"
              data-testid="kb-chunk-config"
            >
              <h3 className="text-sm font-semibold text-foreground">切块参数</h3>
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
                  <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={saveChunkConfig} disabled={busy}>
                    保存切块参数
                  </Button>
                  <p className="text-[11px] text-muted-foreground">修改后需「全部重新向量化」方可生效。</p>
                </>
              )}
            </div>

            {/* 检索参数 */}
            <div
              className="rounded-xl border border-border bg-card p-5 space-y-4"
              data-testid="kb-retrieval-config"
            >
              <h3 className="text-sm font-semibold text-foreground">检索参数</h3>
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
                  <option value="vector">向量检索</option>
                  <option value="fulltext" disabled>全文检索（待支持）</option>
                  <option value="hybrid" disabled>混合检索（待支持）</option>
                </select>
              </label>
              {canManage && (
                <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={saveRetrievalConfig} disabled={busy}>
                  保存检索参数
                </Button>
              )}
            </div>
          </div>

          {/* 权限范围 */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">权限范围</h3>
              {canManage && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleVisibility} disabled={busy}>
                  切换为{visibility === 'restricted' ? '全员可见' : '受限访问'}
                </Button>
              )}
            </div>
            <Badge className={visibility === 'restricted' ? 'bg-yellow-500/10 text-yellow-500 border-0' : 'bg-green-500/10 text-green-500 border-0'}>
              {visibility === 'restricted' ? '受限（仅关联 Agent 可访问）' : '全员可访问'}
            </Badge>
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
                      <Button
                        key={a.id}
                        variant={linked ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleAgent(a.id)}
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
        </TabsContent>

        {/* === 检索测试 === */}
        <TabsContent value="retrieve" className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">语义检索测试</h3>
            <p className="text-xs text-muted-foreground">
              输入问题，测试当前知识库的语义检索效果（使用当前检索参数：Top K={retrCfg.topK}，阈值={retrCfg.scoreThreshold}）。
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入检索问题，如：什么是 AIPaddle？"
                  value={rQuery}
                  onChange={e => setRQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) runRetrieve(); }}
                  disabled={rLoading}
                  className="pl-9 h-10"
                />
              </div>
              <Button onClick={runRetrieve} disabled={rLoading || !rQuery.trim()}>
                {rLoading ? '检索中…' : '检索'}
              </Button>
            </div>
          </div>

          {rDone && (
            <div className="space-y-3">
              {rSegs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  未找到相关内容，请尝试调整问题或降低相似度阈值
                </div>
              ) : (
                rSegs.map((seg, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {seg.filename}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        相似度 {(seg.similarity * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{seg.snippet}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
