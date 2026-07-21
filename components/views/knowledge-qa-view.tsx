'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api/client'
import { Search, FileText, Sparkles, Loader2 } from 'lucide-react'

type Citation = { documentId: string; filename: string; snippet: string; similarity: number }
type RagAnswer = { answer: string; citations: Citation[]; refused: boolean }

const SAMPLES = ['X1 的保修期多久？', 'X1 支持什么无线协议？', 'X1 最多能接多少台设备？']

export function KnowledgeQaView() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RagAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q?: string) {
    const query = (q ?? question).trim()
    if (!query || loading) return
    if (q) setQuestion(q)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await apiFetch<RagAnswer>('/api/knowledge/ask', {
        method: 'POST',
        body: JSON.stringify({ question: query }),
      })
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '问答失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">知识库问答</h1>
        <p className="text-sm text-muted-foreground mt-0.5">基于已上传文档的检索增强问答，答案带来源引用</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="就知识库内容提问，如「X1 的保修期多久？」"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <Button onClick={() => ask()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? '思考中' : '提问'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-1 shrink-0" />
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.answer}</p>
            </div>

            {result.citations.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground">引用来源（{result.citations.length}）</p>
                {result.citations.map((c, i) => (
                  <div key={c.documentId + i} className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-foreground">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{c.filename}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        相关度 {Math.round(c.similarity * 100)}%
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{c.snippet}</p>
                  </div>
                ))}
              </div>
            )}

            {result.refused && (
              <p className="text-xs text-muted-foreground">
                知识库中未找到相关内容。请先在「知识库管理」上传并处理相关文档。
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
