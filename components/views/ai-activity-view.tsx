'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, GitBranch, Bot, Zap, Plug, Clock,
  CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { AiActivity, AiActivityObject } from '@/lib/data/ai-activity'

// AI 操作记录（WF-16）：对话里由系统自动创建了什么，一页看全。
// 回答的是四个很具体的问题：建了什么、谁建的、什么时候、成没成（以及能不能直接发布）。

const OBJECT_META: Record<AiActivityObject, { label: string; icon: typeof GitBranch; href: (id: string) => string }> = {
  workflow: { label: '工作流', icon: GitBranch, href: (id) => `/workflows/${id}` },
  agent: { label: 'Agent', icon: Bot, href: (id) => `/agents-admin?id=${id}` },
  skill: { label: 'Skill', icon: Zap, href: (id) => `/my-skills?id=${id}` },
  plugin: { label: 'Plugin', icon: Plug, href: () => `/plugins/mcp` },
  schedule: { label: '定时作业', icon: Clock, href: () => `/agent-schedules` },
}

const FILTERS: { key: 'all' | AiActivityObject; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'workflow', label: '工作流' },
  { key: 'agent', label: 'Agent' },
  { key: 'skill', label: 'Skill' },
  { key: 'plugin', label: 'Plugin' },
  { key: 'schedule', label: '定时作业' },
]

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** 一条记录的状态：成功/失败之外，还要区分「建好了但体检没过，发不了」 */
function statusOf(a: AiActivity): { tone: 'ok' | 'warn' | 'fail'; text: string; icon: typeof CheckCircle2 } {
  if (!a.success) return { tone: 'fail', text: '失败', icon: XCircle }
  if (a.ready === false) {
    return { tone: 'warn', text: `待补 ${a.readinessIssues ?? ''} 项`.trim(), icon: AlertTriangle }
  }
  return { tone: 'ok', text: '成功', icon: CheckCircle2 }
}

const TONE_CLS = {
  ok: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
  warn: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
  fail: 'text-destructive bg-destructive/10',
} as const

export function AiActivityView({ initial, canViewAll }: { initial: AiActivity[]; canViewAll: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [filter, setFilter] = useState<'all' | AiActivityObject>('all')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (nextScope: 'mine' | 'all') => {
    setLoading(true)
    try {
      const data = await apiFetch<{ items: AiActivity[] }>(
        `/api/ai-activity?limit=200${nextScope === 'all' ? '&scope=all' : ''}`,
      )
      setItems(data.items ?? [])
    } catch {
      // 读失败不清空已有列表——留着旧数据比空屏有用
    } finally {
      setLoading(false)
    }
  }, [])

  const shown = filter === 'all' ? items : items.filter((i) => i.object === filter)
  const failed = items.filter((i) => !i.success).length
  const pending = items.filter((i) => i.success && i.ready === false).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 操作记录
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            对话中由系统自动创建的 Agent、工作流、Skill、Plugin 与定时作业。数据来自不可篡改的审计日志。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 切换即拉取：放在事件回调里而不是 effect——
              在 effect 里同步 setState 会被 React 编译器判为级联渲染 */}
          {canViewAll && (
            <Tabs
              value={scope}
              onValueChange={(v) => {
                const next = v as 'mine' | 'all'
                setScope(next)
                load(next)
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="mine" className="text-xs">我的</TabsTrigger>
                <TabsTrigger value="all" className="text-xs">全租户</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={() => load(scope)} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '创建记录', value: items.length, cls: '' },
          { label: '待补配置（发布被拦）', value: pending, cls: pending ? 'text-amber-600' : '' },
          { label: '创建失败', value: failed, cls: failed ? 'text-destructive' : '' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className={cn('text-2xl font-semibold', s.cls)}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {shown.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            还没有记录。在个人助理或工作流编辑器里用一句话创建对象后，这里会自动留痕。
          </p>
        )}
        {shown.map((a) => {
          const meta = OBJECT_META[a.object]
          const Icon = meta.icon
          const st = statusOf(a)
          const StatusIcon = st.icon
          return (
            <div key={a.id} className="flex items-start gap-3 p-4">
              <div className="mt-0.5 rounded-lg bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.name ?? '（未命名）'}</span>
                  <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                  <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]', TONE_CLS[st.tone])}>
                    <StatusIcon className="h-3 w-3" />
                    {st.text}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.verb} · {a.actorName ?? '未知用户'} · {formatTime(a.createdAt)}
                </p>
                {a.prompt && (
                  <p className="mt-1.5 line-clamp-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    “{a.prompt}”
                  </p>
                )}
                {a.reason && <p className="mt-1.5 text-xs text-destructive">{a.reason}</p>}
              </div>
              {a.success && a.targetId && a.targetId !== '-' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => router.push(meta.href(a.targetId!))}
                >
                  查看 <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
