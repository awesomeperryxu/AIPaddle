'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api/client';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Database,
  Zap,
  Settings2,
  BookOpen,
  Upload,
  FileText,
  X,
} from 'lucide-react';

type ChunkConfig = { chunkSize: number; chunkOverlap: number; separator: string };
type RetrievalConfig = { topK: number; scoreThreshold: number; searchMethod: string };
type PreprocessRules = { stripWhitespace: boolean; removeUrls: boolean };

const SAMPLE_TEXT = `（示例文本）AIPaddle 是面向企业的 AI 业务赋能平台，统一管理 Agent、Skill、知识库与工作流。

平台核心功能包括：数字员工管理、多轮对话、知识库问答、工作流编排。

企业可通过 AIPaddle 快速部署 AI 助手，提升业务效率，降低人力成本。

知识库支持多格式文档（PDF、Word、Excel、TXT、Markdown），自动向量化并提供语义检索。`;

// 客户端可直接读取文本内容的扩展名
const TEXT_EXTS = new Set(['.txt', '.md', '.html', '.htm', '.csv']);

function getExt(filename: string): string {
  const m = filename.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : '';
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.html,.htm';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 客户端预览算法与服务端 chunkText 保持一致（多级分隔符递归 + overlap）
function splitHierarchically(text: string, seps: string[], maxSize: number): string[] {
  if (!text.trim()) return [];
  const [sep, ...rest] = seps;
  // 无更细分隔符（或空分隔符）→ 字符窗口兜底
  if (!sep) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length <= maxSize) return clean ? [clean] : [];
    const chunks: string[] = [];
    for (let i = 0; i < clean.length; i += maxSize) chunks.push(clean.slice(i, i + maxSize));
    return chunks;
  }
  // 先按当前分隔符切（保留原始换行，不预先折叠空白）
  const parts = text.split(sep).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return splitHierarchically(text, rest, maxSize);
  const result: string[] = [];
  for (const part of parts) {
    const normalized = part.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    if (normalized.length <= maxSize) result.push(normalized);
    else result.push(...splitHierarchically(part, rest, maxSize));
  }
  return result;
}

function chunkSample(text: string, cfg: ChunkConfig): string[] {
  const seps = !cfg.separator ? []
    : cfg.separator === '\n\n' ? ['\n\n', '\n']
    : cfg.separator === '\n' ? ['\n']
    : [cfg.separator, '\n\n', '\n'];
  const rawSegs = splitHierarchically(text, seps, cfg.chunkSize);
  if (rawSegs.length === 0) return [];
  if (cfg.chunkOverlap === 0) return rawSegs;
  const result = [rawSegs[0]];
  for (let i = 1; i < rawSegs.length; i++) {
    const tail = rawSegs[i - 1].slice(-cfg.chunkOverlap);
    result.push((tail + ' ' + rawSegs[i]).trim().slice(0, cfg.chunkSize));
  }
  return result;
}

const STEPS = [
  { label: '基本信息', icon: BookOpen },
  { label: '分段设置', icon: Settings2 },
  { label: '索引方式', icon: Database },
];

export function KnowledgeAdminNewView() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Step 2
  const [chunkCfg, setChunkCfg] = useState<ChunkConfig>({
    chunkSize: 1024,
    chunkOverlap: 50,
    separator: '\n\n',
  });
  const [preprocessRules, setPreprocessRules] = useState<PreprocessRules>({
    stripWhitespace: true,
    removeUrls: false,
  });
  // 预览文本：null=尚未读取，'' =读取中/读取失败
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewIsReal, setPreviewIsReal] = useState(false);

  // Step 3
  const [retrCfg, setRetrCfg] = useState<RetrievalConfig>({
    topK: 5,
    scoreThreshold: 0.28,
    searchMethod: 'vector',
  });

  const previewChunks = chunkSample(previewText ?? SAMPLE_TEXT, chunkCfg);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !existing.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name));
  }

  function validateStep(): string | null {
    if (step === 0 && !name.trim()) return '请填写知识库名称';
    if (step === 1 && chunkCfg.chunkSize < 50) return '最大长度不能小于 50';
    return null;
  }

  async function next() {
    if (busy) return;
    const e = validateStep();
    if (e) { setErr(e); return; }
    setErr(null);

    // Step 0 → Step 1：读取第一个文件内容作为真实预览
    if (step === 0) {
      const first = files[0];
      const textFile = files.find(f => TEXT_EXTS.has(getExt(f.name)));
      if (textFile) {
        // 纯文本：客户端直接读，快
        try {
          const content = await readFileAsText(textFile);
          setPreviewText(content.slice(0, 8000));
          setPreviewFilename(textFile.name);
          setPreviewIsReal(true);
        } catch {
          setPreviewText(null);
          setPreviewIsReal(false);
        }
      } else if (first) {
        // BUG-78：PDF/Office 走服务端抽取真实文本（客户端无法解析）
        setPreviewFilename(first.name);
        setBusy(true);
        setUploadProgress(`正在解析「${first.name}」用于预览…`);
        try {
          const fd = new FormData();
          fd.append('file', first);
          const res = await fetch('/api/knowledge-bases/preview', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok && typeof data.text === 'string' && data.text.trim()) {
            setPreviewText(data.text.slice(0, 8000));
            setPreviewIsReal(true);
          } else {
            setPreviewText(null);
            setPreviewIsReal(false);
          }
        } catch {
          setPreviewText(null);
          setPreviewIsReal(false);
        } finally {
          setBusy(false);
          setUploadProgress(null);
        }
      } else {
        setPreviewText(null);
        setPreviewFilename(null);
        setPreviewIsReal(false);
      }
    }

    setStep(s => s + 1);
  }

  async function submit() {
    const e = validateStep();
    if (e) { setErr(e); return; }
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      // 1. 创建知识库
      setUploadProgress('创建知识库…');
      const r = await apiFetch<{ knowledgeBase: { id: string } }>('/api/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined }),
      });
      const kbId = r.knowledgeBase?.id;
      if (!kbId) throw new Error('创建知识库失败');

      // 2. 保存非默认配置
      const isDefaultChunk = chunkCfg.chunkSize === 1024 && chunkCfg.chunkOverlap === 50 && chunkCfg.separator === '\n\n';
      const isDefaultRetr = retrCfg.topK === 5 && retrCfg.scoreThreshold === 0.28 && retrCfg.searchMethod === 'vector';
      await Promise.all([
        !isDefaultChunk && apiFetch(`/api/knowledge-bases/${kbId}`, {
          method: 'PATCH',
          body: JSON.stringify({ chunkConfig: chunkCfg }),
        }),
        !isDefaultRetr && apiFetch(`/api/knowledge-bases/${kbId}`, {
          method: 'PATCH',
          body: JSON.stringify({ retrievalConfig: retrCfg }),
        }),
      ].filter(Boolean));

      // 3. 上传并向量化文件（逐个顺序，方便进度提示）
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`上传文件 ${i + 1}/${files.length}：${file.name}`);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kbId', kbId);
        const upRes = await fetch('/api/documents', { method: 'POST', body: fd });
        const up = await upRes.json();
        if (!upRes.ok) throw new Error(up?.error?.message ?? `上传失败：${file.name}`);
        // 触发向量化（异步，不阻塞跳转）
        apiFetch(`/api/documents/${up.document.id}/process`, { method: 'POST' }).catch(() => {});
      }

      setUploadProgress('完成，跳转中…');
      router.push(`/knowledge-admin/${kbId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建失败');
      setBusy(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => router.push('/knowledge-admin')}
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">创建知识库</h1>
          <p className="text-xs text-muted-foreground mt-0.5">上传文档并配置检索方式</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-10 max-w-2xl mx-auto w-full">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : active
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                }`}>
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-xs font-medium ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mb-6 transition-all ${i < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-2xl">

          {/* Step 1: 基本信息 + 文件上传 */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">知识库基本信息</h2>
                  <p className="text-sm text-muted-foreground">填写名称，然后上传文档文件。</p>
                </div>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">
                    名称 <span className="text-destructive">*</span>
                  </span>
                  <Input
                    value={name}
                    onChange={e => { setName(e.target.value); setErr(null); }}
                    placeholder="如：产品技术文档库"
                    data-testid="kb-create-name"
                    autoFocus
                    className="h-10"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">描述（可选）</span>
                  <Textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="简述知识库用途，帮助 Agent 决策何时调用"
                    rows={2}
                    className="resize-none"
                  />
                </label>
              </div>

              {/* 文件上传区 */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">上传文档</h2>
                  <p className="text-sm text-muted-foreground">
                    支持 PDF、Word、Excel、PPT、TXT、Markdown。可跳过，创建后在详情页补传。
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  className="rounded-lg border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-colors p-8 text-center cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                >
                  <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">拖拽文件到此处，或点击选择</p>
                  <p className="text-xs text-muted-foreground mt-1">可多选，单文件不超过 50MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPT}
                    multiple
                    onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>

                {/* 已选文件列表 */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">已选 {files.length} 个文件</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setFiles([])}
                      >
                        全部清除
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {files.map(f => (
                        <div key={f.name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.name)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: 分段设置 */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-5">
              {/* 配置区 */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">文本分段配置</h2>
                  <p className="text-sm text-muted-foreground">决定文档如何被切分成可检索的片段。</p>
                </div>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">分段标识符</span>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={chunkCfg.separator}
                    onChange={e => setChunkCfg(c => ({ ...c, separator: e.target.value }))}
                  >
                    <option value={'\n\n'}>空行（段落分隔）</option>
                    <option value={'\n'}>换行</option>
                    <option value={''}>不分段（仅按长度）</option>
                  </select>
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">最大块长度（字符）</span>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number" min={50} max={4000}
                      value={chunkCfg.chunkSize}
                      onChange={e => setChunkCfg(c => ({ ...c, chunkSize: Number(e.target.value) }))}
                      className="h-10"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">50–4000</span>
                  </div>
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">块重叠长度（字符）</span>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number" min={0} max={2000}
                      value={chunkCfg.chunkOverlap}
                      onChange={e => setChunkCfg(c => ({ ...c, chunkOverlap: Number(e.target.value) }))}
                      className="h-10"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">建议 10-20%</span>
                  </div>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">文本预处理规则</span>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preprocessRules.stripWhitespace}
                      onChange={e => setPreprocessRules(r => ({ ...r, stripWhitespace: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      替换连续的空格、换行符和制表符
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preprocessRules.removeUrls}
                      onChange={e => setPreprocessRules(r => ({ ...r, removeUrls: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      删除所有 URL 和电子邮件地址
                    </span>
                  </label>
                </div>
              </div>

              {/* 预览区 */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">分段预览</h2>
                  <Badge variant="outline" className="text-xs">{previewChunks.length} 块</Badge>
                </div>

                {/* 数据来源说明 */}
                {previewIsReal ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <FileText className="h-3.5 w-3.5" />
                    来自上传文件：{previewFilename}
                  </div>
                ) : files.length > 0 ? (
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                    <span className="font-medium">注意：</span>
                    {previewFilename
                      ? `「${previewFilename}」暂无法解析出预览文本（可能为扫描件/加密/空文档），`
                      : '上传的文件暂无法解析出预览文本，'}
                    以下为示例文本的分块效果。实际分段将在文件处理后按真实内容生效。
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">未上传文件，以下为示例文本的分块效果</p>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 max-h-72">
                  {previewChunks.map((chunk, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          块 {i + 1}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{chunk.length} 字</span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed line-clamp-3">{chunk}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 索引方式 */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">索引方式</h2>
                  <p className="text-sm text-muted-foreground">决定文档如何被向量化并存储以供检索。</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 高质量（已选中，不可切换） */}
                  <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">高质量</p>
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">推荐</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      使用嵌入模型（DashScope text-embedding-v4）生成语义向量，支持自然语言语义检索，准确度更高。
                    </p>
                  </div>

                  {/* 经济（不可用） */}
                  <div className="rounded-xl border-2 border-border bg-muted/10 p-4 opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Database className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">经济</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">即将支持</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      倒排全文关键词检索，无需嵌入模型，成本更低，适合精确词匹配场景。
                    </p>
                  </div>
                </div>
              </div>

              {/* 检索参数 */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">检索参数</h2>
                  <p className="text-sm text-muted-foreground">Agent 调用知识库时的默认检索行为。</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium text-foreground">召回数量 (Top K)</span>
                    <Input
                      type="number" min={1} max={20}
                      value={retrCfg.topK}
                      onChange={e => setRetrCfg(c => ({ ...c, topK: Number(e.target.value) }))}
                      className="h-10"
                    />
                  </label>
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium text-foreground">相似度阈值（0–1）</span>
                    <Input
                      type="number" min={0} max={1} step={0.01}
                      value={retrCfg.scoreThreshold}
                      onChange={e => setRetrCfg(c => ({ ...c, scoreThreshold: Number(e.target.value) }))}
                      className="h-10"
                    />
                  </label>
                </div>
                <label className="space-y-1.5 block">
                  <span className="text-sm font-medium text-foreground">检索方式</span>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={retrCfg.searchMethod}
                    onChange={e => setRetrCfg(c => ({ ...c, searchMethod: e.target.value }))}
                  >
                    <option value="vector">向量检索（语义）</option>
                    <option value="fulltext" disabled>全文检索（即将支持）</option>
                    <option value="hybrid" disabled>混合检索 + Rerank（即将支持）</option>
                  </select>
                </label>
              </div>

              {/* 文件摘要 */}
              {files.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    将同时上传 {files.length} 个文件并向量化
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {files.map(f => (
                      <Badge key={f.name} variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {f.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 上传进度 */}
              {uploadProgress && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm text-foreground">{uploadProgress}</p>
                  <Progress className="h-1.5" value={undefined} />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {err && (
            <p className="mt-3 text-sm text-destructive" data-testid="kb-create-err">{err}</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pb-8">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => step === 0 ? router.push('/knowledge-admin') : setStep(s => s - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              {step === 0 ? '取消' : '上一步'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={busy}>
                下一步
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy} data-testid="kb-create-submit">
                {busy ? '创建中…' : `完成创建${files.length > 0 ? `（含 ${files.length} 个文件）` : ''}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
