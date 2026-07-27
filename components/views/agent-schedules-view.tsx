'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AgentSchedule, AgentScheduleRun } from '@/lib/data/agent-schedules'
import {
  Clock, Plus, Search, ToggleLeft, ToggleRight, Trash2, ChevronRight,
  X, CheckCircle2, XCircle, Loader2, History, Edit2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api/client'

type Props = {
  schedules: AgentSchedule[]
  canEdit: boolean
}

function cronToHuman(expr: string): string {
  const parts = expr.split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hour, dom, , dow] = parts
  const days = dow === '*' ? '每天' : dow === '1-5' ? '工作日' : `周${dow}`
  if (dom !== '*') return `每月第 ${dom} 天 ${hour}:${min.padStart(2, '0')}`
  return `${days} ${hour}:${min.padStart(2, '0')}`
}

export function AgentSchedulesView({ schedules: initial, canEdit }: Props) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(initial)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [historySchedule, setHistorySchedule] = useState<AgentSchedule | null>(null)
  const [runs, setRuns] = useState<AgentScheduleRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)

  const filtered = schedules.filter(s =>
    s.agentName.toLowerCase().includes(search.toLowerCase()) ||
    s.triggerPrompt.toLowerCase().includes(search.toLowerCase()),
  )

  async function toggleEnabled(s: AgentSchedule) {
    if (!canEdit || togglingId) return
    setTogglingId(s.id)
    try {
      await apiFetch(`/api/agent-schedules/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !s.isEnabled }),
      })
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, isEnabled: !s.isEnabled } : x))
    } catch { /* silent */ }
    finally { setTogglingId(null) }
  }

  async function handleDelete(s: AgentSchedule) {
    if (!canEdit || deletingId) return
    if (!confirm(`确认删除「${s.agentName}」的定时配置？`)) return
    setDeletingId(s.id)
    try {
      await apiFetch(`/api/agent-schedules/${s.id}`, { method: 'DELETE' })
      setSchedules(prev => prev.filter(x => x.id !== s.id))
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  async function openHistory(s: AgentSchedule) {
    setHistorySchedule(s)
    setRuns([])
    setRunsLoading(true)
    try {
      const res = await apiFetch<{ runs: AgentScheduleRun[] }>(`/api/agent-schedules/${s.id}/runs`)
      setRuns(res.runs ?? [])
    } catch { /* silent */ }
    finally { setRunsLoading(false) }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="border-b border-border px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">定时作业</span>
          <span className="text-xs text-muted-foreground ml-1">（{schedules.length} 个）</span>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => router.push('/agent-schedules/new')} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> 新建定时作业
          </Button>
        )}
      </div>

      {/* 搜索 */}
      <div className="px-6 py-3 border-b border-border shrink-0">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索 Agent 或触发内容…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Clock className="h-8 w-8 opacity-30" />
            {search ? '没有匹配的定时作业' : '还没有定时作业，点击右上角新建'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <div
                key={s.id}
                className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4"
              >
                {/* Agent 名称 + cron */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">{s.agentName}</span>
                    <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded font-mono">
                      {cronToHuman(s.cronExpr)}
                    </span>
                    {s.lastStatus === 'success' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                    {s.lastStatus === 'error' && (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    {s.consecutiveFailures >= 3 && (
                      <span className="text-xs text-destructive font-medium">连续失败已停用</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{s.triggerPrompt}</p>
                  {s.nextRunAt && s.isEnabled && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      下次执行：{new Date(s.nextRunAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>

                {/* 操作区 */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 开关 */}
                  {canEdit && (
                    <button
                      onClick={() => toggleEnabled(s)}
                      disabled={togglingId === s.id}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={s.isEnabled ? '点击停用' : '点击启用'}
                    >
                      {togglingId === s.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : s.isEnabled ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  {/* 执行历史 */}
                  <button
                    onClick={() => openHistory(s)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="执行历史"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  {/* 编辑 */}
                  {canEdit && (
                    <button
                      onClick={() => router.push(`/agent-schedules/new?agentId=${s.agentId}`)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="编辑"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {/* 删除 */}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="删除"
                    >
                      {deletingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 执行历史抽屉 */}
      {historySchedule && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setHistorySchedule(null)} />
          <div className="w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="text-sm font-medium">执行历史</div>
                <div className="text-xs text-muted-foreground">{historySchedule.agentName}</div>
              </div>
              <button
                onClick={() => setHistorySchedule(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {runsLoading ? (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
                </div>
              ) : runs.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">暂无执行记录</div>
              ) : (
                <div className="space-y-2">
                  {runs.map(run => (
                    <div key={run.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {run.status === 'success' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : run.status === 'error' ? (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                          <span className={
                            run.status === 'success' ? 'text-emerald-600 text-xs font-medium' :
                            run.status === 'error' ? 'text-destructive text-xs font-medium' :
                            'text-muted-foreground text-xs'
                          }>
                            {run.status === 'success' ? '成功' : run.status === 'error' ? '失败' : '执行中'}
                          </span>
                          {run.durationMs && (
                            <span className="text-xs text-muted-foreground">{run.durationMs}ms</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {run.replySnippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{run.replySnippet}</p>
                      )}
                      {run.error && (
                        <p className="text-xs text-destructive/80 line-clamp-2 mt-1">{run.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
