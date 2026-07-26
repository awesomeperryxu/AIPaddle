'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Database,
  Zap,
  Settings2,
  BookOpen,
} from 'lucide-react';

type ChunkConfig = { chunkSize: number; chunkOverlap: number; separator: string };
type RetrievalConfig = { topK: number; scoreThreshold: number; searchMethod: string };

const SAMPLE_TEXT = `AIPaddle 是面向企业的 AI 业务赋能平台，统一管理 Agent、Skill、知识库与工作流。

平台核心功能包括：数字员工管理、多轮对话、知识库问答、工作流编排。

企业可通过 AIPaddle 快速部署 AI 助手，提升业务效率，降低人力成本。

知识库支持多格式文档（PDF、Word、Excel、TXT、Markdown），自动向量化并提供语义检索。`;

function chunkSample(text: string, cfg: ChunkConfig): string[] {
  const step = cfg.chunkSize - cfg.chunkOverlap;
  if (step <= 0) return [text.slice(0, cfg.chunkSize)];
  const segments = cfg.separator ? text.split(cfg.separator) : [text];
  const chunks: string[] = [];
  for (const seg of segments) {
    const clean = seg.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    for (let i = 0; i < clean.length; i += step) {
      chunks.push(clean.slice(i, i + cfg.chunkSize));
      if (i + cfg.chunkSize >= clean.length) break;
    }
  }
  return chunks;
}

const STEPS = [
  { label: '基本信息', icon: BookOpen },
  { label: '分段设置', icon: Settings2 },
  { label: '索引方式', icon: Database },
];

export function KnowledgeAdminNewView() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  // Step 2
  const [chunkCfg, setChunkCfg] = useState<ChunkConfig>({
    chunkSize: 800,
    chunkOverlap: 100,
    separator: '\n\n',
  });

  // Step 3
  const [indexMethod, setIndexMethod] = useState<'high' | 'economical'>('high');
  const [retrCfg, setRetrCfg] = useState<RetrievalConfig>({
    topK: 5,
    scoreThreshold: 0.28,
    searchMethod: 'vector',
  });

  const previewChunks = chunkSample(SAMPLE_TEXT, chunkCfg);

  function validateStep(): string | null {
    if (step === 0 && !name.trim()) return '请填写知识库名称';
    if (step === 1 && chunkCfg.chunkSize < 50) return '最大长度不能小于 50';
    return null;
  }

  function next() {
    const e = validateStep();
    if (e) { setErr(e); return; }
    setErr(null);
    setStep(s => s + 1);
  }

  async function submit() {
    const e = validateStep();
    if (e) { setErr(e); return; }
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch<{ knowledgeBase: { id: string } }>('/api/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined }),
      });
      const kbId = r.knowledgeBase?.id;
      if (kbId) {
        const isDefaultChunk = chunkCfg.chunkSize === 800 && chunkCfg.chunkOverlap === 100 && chunkCfg.separator === '\n\n';
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
        router.push(`/knowledge-admin/${kbId}`);
      } else {
        router.push('/knowledge-admin');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '创建失败');
      setBusy(false);
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

          {/* Step 1: 基本信息 */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">知识库基本信息</h2>
                  <p className="text-sm text-muted-foreground">知识库名称将显示在 Agent 的知识范围中。</p>
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
                    placeholder="简述知识库的用途，帮助 Agent 更好地决策何时调用该知识库"
                    rows={3}
                    className="resize-none"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground mb-3">支持的文件格式</h2>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'Word (.docx)', 'Excel (.xlsx)', 'PPT (.pptx)', 'TXT', 'Markdown', 'HTML'].map(f => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">文件上传在知识库创建完成后进行，支持批量拖拽上传。</p>
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
                      type="number"
                      min={50}
                      max={4000}
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
                      type="number"
                      min={0}
                      max={2000}
                      value={chunkCfg.chunkOverlap}
                      onChange={e => setChunkCfg(c => ({ ...c, chunkOverlap: Number(e.target.value) }))}
                      className="h-10"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">建议 10-20%</span>
                  </div>
                </label>
              </div>

              {/* 预览区 */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">分段预览</h2>
                  <Badge variant="outline" className="text-xs">{previewChunks.length} 块</Badge>
                </div>
                <p className="text-xs text-muted-foreground">以下为示例文本的分块效果</p>
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
                  {/* 高质量 */}
                  <button
                    type="button"
                    onClick={() => setIndexMethod('high')}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      indexMethod === 'high'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/20 hover:border-border/80'
                    }`}
                  >
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
                  </button>

                  {/* 经济 */}
                  <button
                    type="button"
                    disabled
                    className="rounded-xl border-2 border-border bg-muted/10 p-4 text-left opacity-50 cursor-not-allowed"
                  >
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
                  </button>
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
              onClick={() => step === 0 ? router.push('/knowledge-admin') : setStep(s => s - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              {step === 0 ? '取消' : '上一步'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                下一步
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy} data-testid="kb-create-submit">
                {busy ? '创建中…' : '完成创建'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
