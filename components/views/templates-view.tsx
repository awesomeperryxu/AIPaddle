'use client'

import { useState, useMemo } from 'react'
import { Search, X, Bot, MessageSquare, Workflow, FileText, Cpu, Info, CheckCircle2, Loader2, AlertCircle, Wrench } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Template, TemplateType } from '@/lib/data/templates'
import type { RequiredSkill } from '@/lib/agents/config'
import { apiFetch } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  '全部',
  '新手入门',
  'Knowledge Retrieval',
  'Research',
  '商业数据分析',
  'AI编程',
  '团队提效',
  '客服与运营支持',
  '市场与内容营销',
  '研究助手',
]

const TYPE_FILTERS: { value: TemplateType | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all',              label: '全部',    icon: <Cpu className="h-3.5 w-3.5" /> },
  { value: 'agent',            label: 'Agent',   icon: <Bot className="h-3.5 w-3.5" /> },
  { value: 'assistant',        label: '聊天助手', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { value: 'chatflow',         label: 'Chatflow', icon: <Workflow className="h-3.5 w-3.5" /> },
  { value: 'workflow',         label: '工作流',   icon: <Workflow className="h-3.5 w-3.5" /> },
  { value: 'text-generation',  label: '文本生成', icon: <FileText className="h-3.5 w-3.5" /> },
]

const TYPE_COLORS: Record<TemplateType, string> = {
  agent:            'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  assistant:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  chatflow:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  workflow:         'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'text-generation':'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

const TYPE_LABELS: Record<TemplateType, string> = {
  agent:            'Agent',
  assistant:        '聊天助手',
  chatflow:         'Chatflow',
  workflow:         '工作流',
  'text-generation':'文本生成',
}

interface Props {
  initialTemplates: Template[]
}

export function TemplatesView({ initialTemplates }: Props) {
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('全部')
  const [typeFilter, setTypeFilter] = useState<TemplateType | 'all'>('all')
  const [selected, setSelected]     = useState<Template | null>(null)
  const [useTarget, setUseTarget]   = useState<Template | null>(null)

  function openUseDialog(tpl: Template) {
    setSelected(null)
    setUseTarget(tpl)
  }

  const filtered = useMemo(() => {
    return initialTemplates.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (category !== '全部' && t.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
      }
      return true
    })
  }, [initialTemplates, typeFilter, category, search])

  return (
    <div className="flex h-full">
      {/* ── 左侧分类 ── */}
      <aside className="w-48 shrink-0 border-r border-border/50 p-4 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          分类
        </p>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'w-full text-left text-sm rounded-md px-3 py-1.5 transition-colors',
              category === cat
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </aside>

      {/* ── 主内容区 ── */}
      <div className="flex-1 overflow-auto">
        {/* 顶部搜索 + 类型筛选 */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-6 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索模板名称或描述..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} 个模板</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors',
                  typeFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
                )}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 模板卡片网格 */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              没有找到匹配的模板
            </div>
          )}
          {filtered.map(tpl => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onUse={() => openUseDialog(tpl)}
              onDetail={() => setSelected(tpl)}
            />
          ))}
        </div>
      </div>

      {/* ── 详情抽屉 ── */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent side="right" className="w-[420px] overflow-y-auto">
          {selected && (
            <TemplateDetail
              template={selected}
              onClose={() => setSelected(null)}
              onUse={() => openUseDialog(selected)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── 使用模板弹窗（key 变更时重置内部 state，避免 useEffect） ── */}
      <UseTemplateDialog
        key={useTarget?.id ?? 'none'}
        template={useTarget}
        open={!!useTarget}
        onOpenChange={open => !open && setUseTarget(null)}
      />
    </div>
  )
}

// ── 模板卡片 ────────────────────────────────────────────────────────────────

function TemplateCard({
  template: tpl,
  onUse,
  onDetail,
}: {
  template: Template
  onUse: () => void
  onDetail: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="relative group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 cursor-pointer transition-shadow hover:shadow-md"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onDetail}
    >
      {/* 图标 + 类型徽标 */}
      <div className="flex items-start justify-between gap-1">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: tpl.iconBackground }}
        >
          {tpl.icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={cn('text-[11px] font-medium', TYPE_COLORS[tpl.type])}>
            {TYPE_LABELS[tpl.type]}
          </Badge>
          {(tpl.type === 'chatflow' || tpl.type === 'workflow') && (
            <Badge variant="outline" className="text-[10px] border-amber-400/60 text-amber-600 dark:text-amber-400">
              框架
            </Badge>
          )}
        </div>
      </div>

      {/* 名称 + 描述 */}
      <div className="flex-1">
        <p className="font-semibold text-sm leading-tight mb-1">{tpl.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-3">{tpl.description}</p>
      </div>

      {/* hover 操作浮层 */}
      {hover && (
        <div
          className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-xl flex items-center justify-center gap-3"
          onClick={e => e.stopPropagation()}
        >
          <Button size="sm" onClick={onUse}>使用该模板</Button>
          <Button size="sm" variant="outline" onClick={onDetail}>详情</Button>
        </div>
      )}
    </div>
  )
}

// ── 使用模板弹窗 ─────────────────────────────────────────────────────────────

type DepStatus = 'pending' | 'installing' | 'done' | 'error'
type DepItem = RequiredSkill & { status: DepStatus }

const TARGET_LABEL: Record<TemplateType, string> = {
  agent:            'Agent',
  assistant:        'Agent（聊天助手）',
  chatflow:         'Chatflow 工作流',
  workflow:         '工作流',
  'text-generation':'Prompt Skill',
}

function UseTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: Template | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName]             = useState(template?.name ?? '')
  const [desc, setDesc]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [phase, setPhase]           = useState<'input' | 'deps'>('input')
  const [redirectUrl, setRedirectUrl] = useState('/agents-admin')
  const [deps, setDeps]             = useState<DepItem[]>([])
  const [installing, setInstalling] = useState(false)
  const [installDone, setInstallDone] = useState(false)

  const requiredSkills: RequiredSkill[] = Array.isArray(template?.dsl?.requiredSkills)
    ? (template!.dsl.requiredSkills as RequiredSkill[])
    : []

  // ── 统一创建流程（所有模板类型走相同路径）──
  async function handleCreate() {
    if (!template || !name.trim()) { setError('名称不能为空'); return }
    setLoading(true)
    setError(null)
    try {
      const t   = template.type
      const dsl = template.dsl as Record<string, unknown>
      const description = desc.trim() || template.description || ''
      let nextUrl = '/agents-admin'

      if (t === 'agent' || t === 'assistant') {
        const config: Record<string, unknown> = {}
        if (dsl.systemPrompt)          config.systemPrompt   = dsl.systemPrompt
        if (dsl.model)                 config.model          = dsl.model
        if (dsl.temperature !== undefined) config.temperature = dsl.temperature
        if (dsl.requiredSkills)        config.requiredSkills = dsl.requiredSkills
        if (Array.isArray(dsl.variables)) config.variables   = dsl.variables
        const { agent } = await apiFetch<{ agent: { id: string } }>('/api/agents', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), description, config }),
        })
        nextUrl = `/agents-admin/${agent.id}`
      } else if (t === 'chatflow' || t === 'workflow') {
        const { workflow } = await apiFetch<{ workflow: { id: string } }>('/api/workflows', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), type: t, description }),
        })
        nextUrl = `/workflows/${workflow.id}`
      } else {
        // text-generation → Prompt Skill
        const config: Record<string, unknown> = {}
        if (dsl.prompt_template)           config.promptTemplate = dsl.prompt_template
        if (Array.isArray(dsl.variables))  config.variables      = dsl.variables
        if (dsl.model)                     config.model          = dsl.model
        if (dsl.temperature !== undefined) config.temperature    = dsl.temperature
        await apiFetch('/api/skills', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), type: 'Prompt', description, config }),
        })
        nextUrl = '/my-skills'
      }

      // 统一：有依赖工具 → 进入安装阶段；无依赖 → 直接跳转
      setRedirectUrl(nextUrl)
      if (requiredSkills.length > 0) {
        setDeps(requiredSkills.map(s => ({ ...s, status: 'pending' as const })))
        setPhase('deps')
      } else {
        onOpenChange(false)
        router.push(nextUrl)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // ── 一键安装依赖工具 ──
  async function handleInstall() {
    setInstalling(true)
    const items = deps.map(d => ({ ...d }))
    for (let i = 0; i < items.length; i++) {
      items[i].status = 'installing'
      setDeps([...items])
      try {
        await apiFetch('/api/skills', {
          method: 'POST',
          body: JSON.stringify({ name: items[i].name, type: 'Prompt', description: items[i].description ?? '' }),
        })
        items[i].status = 'done'
      } catch {
        items[i].status = 'error'
      }
      setDeps([...items])
    }
    setInstalling(false)
    setInstallDone(true)
  }

  function handleFinish() {
    onOpenChange(false)
    router.push(redirectUrl)
  }

  // ── 依赖安装阶段 ──
  if (phase === 'deps') {
    const doneCount  = deps.filter(d => d.status === 'done').length
    const errorCount = deps.filter(d => d.status === 'error').length

    return (
      <Dialog open={open} onOpenChange={o => { if (!o && !installing) handleFinish() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              配置工具依赖
            </DialogTitle>
            <DialogDescription>
              此模板需要以下工具才能发挥完整能力，点击「安装工具」自动创建草稿到工具库，之后可在「工具管理」中配置和发布。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {deps.map(dep => (
              <div key={dep.key} className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                <span className="text-xl shrink-0">{dep.icon ?? '🔧'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{dep.name}</p>
                  {dep.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dep.description}</p>
                  )}
                </div>
                <span className="shrink-0">
                  {dep.status === 'pending'    && <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 inline-block" />}
                  {dep.status === 'installing' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                  {dep.status === 'done'       && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {dep.status === 'error'      && <AlertCircle className="h-5 w-5 text-destructive" />}
                </span>
              </div>
            ))}

            {installDone && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                {errorCount === 0
                  ? `✓ 已成功安装 ${doneCount} 个工具，可在工具库中查看和配置`
                  : `已安装 ${doneCount} 个，${errorCount} 个失败（可能权限不足）`}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {!installDone ? (
              <>
                <Button variant="outline" onClick={handleFinish} disabled={installing}>
                  跳过
                </Button>
                <Button onClick={handleInstall} disabled={installing}>
                  {installing
                    ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />安装中…</>
                    : '安装工具'}
                </Button>
              </>
            ) : (
              <Button onClick={handleFinish} className="w-full">
                完成
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── 输入阶段（与 Dify 一致：名称 + 描述） ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {template && (
            <div className="flex items-center gap-3 mb-2">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: template.iconBackground }}
              >
                {template.icon}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">{template.name}</DialogTitle>
                <Badge className={cn('text-[11px] mt-0.5', TYPE_COLORS[template.type])}>
                  {TARGET_LABEL[template.type]}
                </Badge>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* 框架模板提示 */}
          {template && (template.type === 'chatflow' || template.type === 'workflow') && (
            <div className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>此为框架模板，仅预置名称与分类，创建后进入空白画布手动搭建节点。</span>
            </div>
          )}

          {/* 依赖工具提示 */}
          {requiredSkills.length > 0 && (
            <div className="flex gap-2 items-start bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 text-xs text-primary">
              <Wrench className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>此模板需要 {requiredSkills.length} 个工具，创建后将自动引导安装。</span>
            </div>
          )}

          {/* 名称 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">应用名称</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /* 回车不提交，须点按钮 */
              placeholder="为应用取个名字"
              autoFocus
            />
          </div>

          {/* 描述（与 Dify 一致） */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              应用描述
              <span className="ml-1 text-xs font-normal text-muted-foreground">（可选）</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder={template?.description ?? '描述这个应用的用途...'}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 详情面板 ────────────────────────────────────────────────────────────────

function TemplateDetail({ template: tpl, onClose, onUse }: { template: Template; onClose: () => void; onUse: () => void }) {
  return (
    <>
      <SheetHeader className="pb-4 border-b">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: tpl.iconBackground }}
          >
            {tpl.icon}
          </div>
          <div>
            <SheetTitle className="text-base">{tpl.name}</SheetTitle>
            <Badge className={cn('text-[11px] mt-0.5', TYPE_COLORS[tpl.type])}>
              {TYPE_LABELS[tpl.type]}
            </Badge>
          </div>
        </div>
      </SheetHeader>

      <div className="py-4 space-y-5">
        {/* 描述 */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">描述</p>
          <p className="text-sm text-foreground">{tpl.description ?? '暂无描述'}</p>
        </section>

        {/* 分类 + 标签 */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">分类 / 标签</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{tpl.category}</Badge>
            {tpl.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </section>

        {/* 来源 */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">来源</p>
          <p className="text-xs text-muted-foreground">
            Dify 开源仓库（
            <a
              href="https://github.com/langgenius/dify"
              target="_blank"
              rel="noreferrer"
              className="underline"
              onClick={e => e.stopPropagation()}
            >
              Apache-2.0
            </a>
            ）
          </p>
        </section>

        {/* DSL 预览（Agent 类型展示 systemPrompt） */}
        {tpl.type === 'agent' && !!tpl.dsl?.systemPrompt && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">系统提示词</p>
            <pre className="text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {String(tpl.dsl.systemPrompt)}
            </pre>
          </section>
        )}

        {tpl.type === 'text-generation' && !!tpl.dsl?.prompt_template && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">提示词模板</p>
            <pre className="text-xs bg-muted rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {String(tpl.dsl.prompt_template)}
            </pre>
          </section>
        )}
      </div>

      {/* 底部操作 */}
      <div className="border-t pt-4 flex gap-3">
        <Button className="flex-1" onClick={onUse}>使用该模板</Button>
        <Button variant="outline" onClick={onClose}>关闭</Button>
      </div>
    </>
  )
}
