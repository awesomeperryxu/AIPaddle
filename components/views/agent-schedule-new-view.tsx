'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Agent } from '@/lib/mock-data'
import { apiFetch } from '@/lib/api/client'
import { validateCron } from '@/lib/agents/cron-validate'
import {
  ArrowLeft, Send, Loader2, Check, Clock, Bot, ChevronDown,
} from 'lucide-react'

type Props = {
  agents: Agent[]
  digitalEmployeeIds: string[]
  defaultAgentId: string | null
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type ParsedSchedule = {
  cronExpr: string
  triggerPrompt: string
  summary: string
  nextRuns: string[]
}

export function AgentScheduleNewView({ agents, digitalEmployeeIds, defaultAgentId }: Props) {
  const router = useRouter()
  const deSet = new Set(digitalEmployeeIds)

  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId ?? (agents[0]?.id ?? ''))
  const [agentDropOpen, setAgentDropOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: '你好！请用自然语言描述这个 Agent 的定时任务。\n\n例如：「每天早上 9 点，汇总昨日销售数据并生成简报」',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null)
  // 用户手改解析结果后的校验。cron 写错会让定时静默不触发——
  // 存下去要到第一次该跑却没跑时才发现，所以在保存前就拦住
  const [cronError, setCronError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    if (!selectedAgentId) { alert('请先选择 Agent'); return }

    setInput('')
    const history = messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0)
    const nextMsgs: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMsgs)
    setLoading(true)

    try {
      const res = await apiFetch<{ reply?: string; parsed?: ParsedSchedule | null; error?: { message?: string } }>(
        '/api/agent-schedules/parse',
        {
          method: 'POST',
          body: JSON.stringify({
            message: text,
            agentName: selectedAgent?.name ?? 'Agent',
            history: history.map(m => ({ role: m.role, content: m.content })),
          }),
        },
      )
      const reply = res.reply ?? '好的，已理解。'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (res.parsed) setParsed(res.parsed)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 解析失败，请重试' }])
    } finally {
      setLoading(false)
    }
  }

  /** 就地修改 AI 解析结果，并即时校验 cron */
  function updateParsed(patch: Partial<ParsedSchedule>) {
    setParsed((p) => (p ? { ...p, ...patch } : p))
    if (patch.cronExpr !== undefined) setCronError(validateCron(patch.cronExpr))
  }

  async function saveSchedule() {
    if (!parsed || !selectedAgentId || saving) return
    // 手改过的 cron 必须先合法，否则存进去到点不触发、还查不出原因
    const err = validateCron(parsed.cronExpr)
    if (err) { setCronError(err); return }
    if (!parsed.triggerPrompt.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 触发指令不能为空——到点时没有指令可发给 Agent。' }])
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/agent-schedules', {
        method: 'POST',
        body: JSON.stringify({
          agentId: selectedAgentId,
          cronExpr: parsed.cronExpr,
          triggerPrompt: parsed.triggerPrompt,
        }),
      })
      setSaved(true)
      setTimeout(() => router.push('/agent-schedules'), 1200)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '保存失败'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg.includes('已有') ? '该 Agent 已有定时配置，请在管理页修改' : '保存失败，请重试'}` }])
    } finally {
      setSaving(false)
    }
  }

  function resetParsed() {
    setParsed(null)
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '好的，我们继续调整。请告诉我你想怎么修改？' },
    ])
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="border-b border-border px-4 h-14 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/agent-schedules')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">新建定时作业</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左：聊天配置区 */}
        <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
          {/* Agent 选择器 */}
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="text-xs text-muted-foreground mb-1.5">选择 Agent</div>
            <div className="relative">
              <button
                onClick={() => setAgentDropOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {selectedAgent ? (
                      <>
                        {selectedAgent.name}
                        {deSet.has(selectedAgent.id) && (
                          <span className="ml-1.5 text-[10px] text-violet-600 bg-violet-100 dark:bg-violet-950/40 px-1 py-0.5 rounded">数字员工</span>
                        )}
                      </>
                    ) : '请选择…'}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
              {agentDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg overflow-auto max-h-60">
                  {agents.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">无已发布 Agent</div>
                  ) : agents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAgentId(a.id); setAgentDropOpen(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors ${selectedAgentId === a.id ? 'bg-primary/5 text-primary' : ''}`}
                    >
                      <Bot className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.name}</span>
                      {deSet.has(a.id) && (
                        <span className="ml-auto text-[10px] text-violet-600 bg-violet-100 dark:bg-violet-950/40 px-1 py-0.5 rounded shrink-0">数字员工</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 对话区 */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在解析…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 输入框 */}
          <div className="border-t border-border px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
                }}
                placeholder="描述定时任务，例如：每周一早上8点 发送本周工作计划提醒…"
                className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 min-h-[56px] max-h-[120px]"
                rows={2}
                disabled={loading || saved}
              />
              <Button
                size="icon"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading || saved}
                className="self-end shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Enter 发送，Shift+Enter 换行</p>
          </div>
        </div>

        {/* 右：配置预览 */}
        <div className="w-72 flex flex-col shrink-0 overflow-auto">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground">配置预览</div>
          </div>
          {!parsed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2 p-6 text-center">
              <Clock className="h-8 w-8 opacity-30" />
              <p>在左侧用自然语言描述任务，AI 解析完成后预览配置</p>
            </div>
          ) : (
            <div className="flex-1 p-4 space-y-4">
              {/* AI 解析结果可直接改：解析未必每次都合心意，
                  只读的话用户得回到左侧重新描述一遍，改一个小时点也要重来 */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] text-muted-foreground">执行计划</div>
                    {cronError && <span className="text-[10px] text-destructive">{cronError}</span>}
                  </div>
                  <div className="text-sm font-medium mb-1.5">{parsed.summary}</div>
                  <input
                    value={parsed.cronExpr}
                    onChange={(e) => updateParsed({ cronExpr: e.target.value })}
                    aria-label="cron 表达式"
                    className={`w-full rounded-md border px-2 py-1.5 text-xs font-mono bg-background outline-none focus:ring-1 ${
                      cronError ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:ring-primary/30'
                    }`}
                    placeholder="分 时 日 月 周，如 0 8 * * *"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    五段式：分 时 日 月 周（Asia/Shanghai）。改动后下方「接下来 5 次」是 AI 按原计划算的，仅供参考。
                  </p>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">触发指令</div>
                  <textarea
                    value={parsed.triggerPrompt}
                    onChange={(e) => updateParsed({ triggerPrompt: e.target.value })}
                    aria-label="触发指令"
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:ring-1 focus:ring-primary/30 resize-y"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    到点时发给该 Agent 的指令。若 Agent 以工作流为大脑，这段会作为流程的输入。
                  </p>
                </div>
              </div>

              {parsed.nextRuns?.length > 0 && (
                <div>
                  <div className="text-[11px] text-muted-foreground mb-2">接下来 5 次执行</div>
                  <div className="space-y-1">
                    {parsed.nextRuns.map((t, i) => (
                      <div key={i} className="text-xs text-foreground/80 flex items-center gap-1.5">
                        <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="space-y-2 pt-2">
                {saved ? (
                  <Button className="w-full gap-2" variant="outline" disabled>
                    <Check className="h-4 w-4 text-emerald-500" /> 已保存，跳转中…
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => void saveSchedule()}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      确认保存
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={resetParsed}
                      disabled={saving}
                    >
                      继续调整
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
