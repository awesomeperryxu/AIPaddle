'use client'

import { useState, useMemo } from 'react'
import { Search, X, Bot, MessageSquare, Workflow, FileText, Cpu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Template, TemplateType } from '@/lib/data/templates'
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
              onUse={() => setSelected(tpl)}
              onDetail={() => setSelected(tpl)}
            />
          ))}
        </div>
      </div>

      {/* ── 详情抽屉 ── */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent side="right" className="w-[420px] overflow-y-auto">
          {selected && <TemplateDetail template={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
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
      <div className="flex items-start justify-between">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: tpl.iconBackground }}
        >
          {tpl.icon}
        </div>
        <Badge className={cn('text-[11px] font-medium', TYPE_COLORS[tpl.type])}>
          {TYPE_LABELS[tpl.type]}
        </Badge>
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

// ── 详情面板 ────────────────────────────────────────────────────────────────

function TemplateDetail({ template: tpl, onClose }: { template: Template; onClose: () => void }) {
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
        <Button className="flex-1" onClick={onClose}>使用该模板</Button>
        <Button variant="outline" onClick={onClose}>关闭</Button>
      </div>
    </>
  )
}
