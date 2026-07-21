'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api/client'
import {
  Database,
  Send,
  Sparkles,
  MessageSquare,
  FolderOpen,
  Loader2,
} from 'lucide-react'

type Citation = { documentId: string; filename: string; snippet: string; similarity: number }
type RagAnswer = { answer: string; citations: Citation[]; refused: boolean }

// 结果附带的客户端可观测元信息（耗时为真实测量，模型/模式来自检索设置）
type AskResult = RagAnswer & { latencyMs: number; model: string; mode: string }

// 模块级 helper：规避 React Compiler purity 规则对 render 作用域内直接调用 Date.now 的限制
const nowMs = () => Date.now()

// 知识库列表（暂无后端，UI mock；选中项作为提问上下文占位）
const KNOWLEDGE_BASES = [
  { id: 'kb-001', name: '企业规章制度库', documents: 12, size: '4.2 MB' },
  { id: 'kb-002', name: '产品技术文档', documents: 28, size: '11.6 MB' },
  { id: 'kb-003', name: '客服知识库', documents: 45, size: '8.1 MB' },
]

// 最近提问历史（暂无后端，UI mock）
const RECENT_HISTORY = [
  { q: '公司的年假政策是怎样的？', kb: '企业规章制度库', time: '10 分钟前' },
  { q: '差旅报销需要哪些票据？', kb: '企业规章制度库', time: '1 小时前' },
  { q: 'X1 的保修期多久？', kb: '产品技术文档', time: '昨天' },
]

const SUGGESTIONS = ['公司的年假政策是怎样的？', '差旅报销需要哪些票据？']

const RETRIEVAL_MODES = [
  { value: 'hybrid', label: '混合检索' },
  { value: 'vector', label: '向量检索' },
  { value: 'keyword', label: '关键词检索' },
]
const TOP_K_OPTIONS = ['3', '5', '10']
const THRESHOLD_OPTIONS = ['0.50', '0.60', '0.70', '0.80']
const MODEL_OPTIONS = ['GPT-4-Turbo', 'GPT-4o', 'Qwen-Max']

// 依据相关性评分返回徽章与进度条配色
function scoreTone(similarity: number) {
  if (similarity >= 0.85) return { badge: 'bg-emerald-500/12 text-emerald-400', bar: 'bg-emerald-500' }
  if (similarity >= 0.6) return { badge: 'bg-yellow-500/12 text-yellow-400', bar: 'bg-yellow-500' }
  return { badge: 'bg-red-500/12 text-red-400', bar: 'bg-red-500' }
}

export function KnowledgeQaView() {
  const [kbId, setKbId] = useState(KNOWLEDGE_BASES[0].id)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 检索设置（暂无后端，仅 UI）
  const [mode, setMode] = useState('hybrid')
  const [topK, setTopK] = useState('3')
  const [threshold, setThreshold] = useState('0.60')
  const [model, setModel] = useState('GPT-4-Turbo')

  const activeKb = useMemo(
    () => KNOWLEDGE_BASES.find((k) => k.id === kbId) ?? KNOWLEDGE_BASES[0],
    [kbId],
  )
  const modeLabel = RETRIEVAL_MODES.find((m) => m.value === mode)?.label ?? '混合检索'

  async function ask(q?: string) {
    const query = (q ?? question).trim()
    if (!query || loading) return
    if (q) setQuestion(q)
    setLoading(true)
    setError(null)
    setResult(null)
    const startedAt = nowMs()
    try {
      const r = await apiFetch<RagAnswer>('/api/knowledge/ask', {
        method: 'POST',
        body: JSON.stringify({ question: query }),
      })
      setResult({ ...r, latencyMs: nowMs() - startedAt, model, mode: modeLabel })
    } catch (e) {
      setError(e instanceof Error ? e.message : '问答失败')
    } finally {
      setLoading(false)
    }
  }

  function selectKb(id: string) {
    setKbId(id)
    setResult(null)
    setError(null)
  }

  const hasResult = !!result && !result.refused && result.citations.length >= 0

  return (
    <div className="flex gap-6 h-[calc(100vh-88px)] px-6 py-6">
      {/* 左栏：288px 固定侧栏 */}
      <aside className="w-72 flex-none flex flex-col gap-4 overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold text-foreground">知识库问答</h1>
          <p className="text-sm text-muted-foreground mt-0.5">检索测试：查看召回分段与相关性评分</p>
        </div>

        {/* 选择知识库 */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">选择知识库</p>
          <div className="flex flex-col gap-2">
            {KNOWLEDGE_BASES.map((kb) => {
              const active = kb.id === kbId
              return (
                <button
                  key={kb.id}
                  onClick={() => selectKb(kb.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-card hover:border-foreground/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-[15px] w-[15px] text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{kb.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kb.documents} 文档 · {kb.size}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 检索设置 */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">检索设置</p>
          <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground shrink-0">检索模式</span>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger size="sm" className="h-7 w-[120px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETRIEVAL_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground shrink-0">Top K</span>
              <Select value={topK} onValueChange={setTopK}>
                <SelectTrigger size="sm" className="h-7 w-[120px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOP_K_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground shrink-0">相关性阈值</span>
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger size="sm" className="h-7 w-[120px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground shrink-0">生成模型</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger size="sm" className="h-7 w-[120px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 最近提问 */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">最近提问</p>
          <div className="flex flex-col gap-1.5">
            {RECENT_HISTORY.map((h, i) => (
              <button
                key={i}
                onClick={() => ask(h.q)}
                className="rounded-md bg-muted/30 px-2.5 py-2 text-left hover:bg-muted transition"
              >
                <span className="block truncate text-[13px] text-foreground">{h.q}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {h.kb} · {h.time}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* 右栏：提问 + 结果 */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        {/* 提问卡 */}
        <Card className="flex-none border-border">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ask()}
                  placeholder={`向「${activeKb.name}」提问，例如：公司的年假政策是怎样的？`}
                  className="h-[42px] w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <Button onClick={() => ask()} disabled={loading} className="h-[42px] gap-2 px-4.5">
                {loading ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Send className="h-[15px] w-[15px]" />}
                {loading ? '思考中' : '提问'}
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="h-[26px] rounded-full border border-border px-2.5 text-xs text-foreground hover:bg-muted transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (result.refused || result.citations.length === 0) ? (
          <Card className="flex-none border-border">
            <CardContent className="p-5">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.answer}</p>
              {result.refused && (
                <p className="mt-3 text-xs text-muted-foreground">
                  知识库中未找到相关内容。请先在「知识库管理」上传并处理相关文档。
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {hasResult && result.citations.length > 0 && (
          <>
            {/* 生成回答 */}
            <Card className="flex-none border-border">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    生成回答
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    耗时 {(result.latencyMs / 1000).toFixed(1)}s · {result.model} · {result.mode}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-[1.8]">{result.answer}</p>
              </CardContent>
            </Card>

            {/* 召回分段 */}
            <Card className="border-border">
              <CardContent className="p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Database className="h-4 w-4 text-teal-400" />
                  召回分段（{result.citations.length}）
                </h3>
                <div className="flex flex-col gap-3">
                  {result.citations.map((c, i) => {
                    const tone = scoreTone(c.similarity)
                    const pct = Math.round(c.similarity * 100)
                    return (
                      <div
                        key={c.documentId + i}
                        className="rounded-lg border border-border bg-muted/30 p-3.5"
                      >
                        <div className="mb-2 flex items-center gap-2.5">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
                            {c.similarity.toFixed(2)}
                          </span>
                          <span className="text-[13px] font-medium text-foreground">{c.filename}</span>
                          <span className="text-xs text-muted-foreground">片段 {i + 1}</span>
                          <div className="flex-1" />
                          <div className="h-1 w-[90px] shrink-0 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <p className="text-[13px] leading-[1.7] text-muted-foreground">{c.snippet}</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* 空状态 */}
        {!result && !error && !loading && (
          <div className="flex flex-1 items-center justify-center min-h-[300px]">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20">
                <Database className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-[17px] font-semibold text-foreground">基于「{activeKb.name}」提问</h2>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                回答将附带召回分段与相关性评分，便于验证检索质量
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
