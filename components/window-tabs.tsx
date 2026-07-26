'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

// 多窗口标签条（顶部）：每个标签 = 一个已打开的视图（href）。
// 路由式多标签：点击标签切换视图、× 关闭；首页「监控」为固定标签不可关闭。
export function WindowTabs({
  tabs,
  activeView,
  titleOf,
  homeView,
  onSelect,
  onClose,
}: {
  tabs: string[]
  activeView: string
  titleOf: (view: string) => string
  homeView: string
  onSelect: (view: string) => void
  onClose: (view: string) => void
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar" role="tablist">
      {tabs.map((view) => {
        const active = view === activeView
        const closable = view !== homeView
        return (
          <div
            key={view}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(view)}
            className={cn(
              'group flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-md text-xs cursor-pointer whitespace-nowrap transition-colors shrink-0',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span>{titleOf(view)}</span>
            {closable && (
              <button
                type="button"
                aria-label={`关闭 ${titleOf(view)}`}
                onClick={(e) => { e.stopPropagation(); onClose(view) }}
                className={cn(
                  'flex items-center justify-center h-4 w-4 rounded hover:bg-foreground/10 transition-colors',
                  active ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100',
                )}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
