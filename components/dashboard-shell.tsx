'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { WindowTabs } from '@/components/window-tabs'
import { TabTitleProvider } from '@/components/tab-title'
import { isPinnableView, resolveTabTitle } from '@/lib/nav/views'

const HOME_VIEW = 'dashboard'

export function DashboardShell({
  userName,
  userRole = '成员',
  orgName = '—',
  defaultModel,
  canManageTenant,
  children,
}: {
  userName: string
  userRole?: string
  orgName?: string
  defaultModel?: string
  canManageTenant?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const activeView = pathname.replace(/^\//, '') || HOME_VIEW

  // 多窗口标签：已「钉住」的视图集合（首页固定在最前）。
  // 用 sessionStorage 持久化——页面刷新/导航不丢失标签（PR #183）。
  const STORAGE_KEY = 'aipaddle_pinned_tabs'
  const [pinned, setPinned] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as string[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 确保首页在最前 + 当前页在列表中
            const set = new Set(parsed)
            set.add(HOME_VIEW)
            if (isPinnableView(activeView)) set.add(activeView)
            return [HOME_VIEW, ...[...set].filter((v) => v !== HOME_VIEW)]
          }
        }
      } catch { /* SSR 或 parse 失败 */ }
    }
    return activeView !== HOME_VIEW && isPinnableView(activeView) ? [HOME_VIEW, activeView] : [HOME_VIEW]
  })

  // pinned 变化时持久化到 sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pinned)) } catch { /* ignore */ }
  }, [pinned])

  // 侧栏高亮用一级段（`workflows/<id>` 时仍高亮「工作流管理」），但**标签本身不折叠**：
  // 折叠到一级标签的话，点它回到的是列表页，用户那条具体的流程照样找不回来——
  // 而「切走后回不到那条流程」正是 WF-19 要修的问题。
  const topView = activeView.split('/')[0]

  // 详情页上报的名字：view → 显示名。没上报的回落到「一级名 · 详情」。
  const [detailTitles, setDetailTitles] = useState<Record<string, string>>({})
  const reportTitle = useCallback((view: string, title: string | undefined) => {
    setDetailTitles((prev) => {
      if ((prev[view] ?? undefined) === title) return prev // 同值不重渲染，避免上报→重渲→再上报
      const next = { ...prev }
      if (title) next[view] = title
      else delete next[view]
      return next
    })
  }, [])

  const titleOf = useCallback((view: string) => resolveTabTitle(view, detailTitles), [detailTitles])

  // 渲染期派生：始终把当前视图并入展示（覆盖页面内的程序化跳转），无需 effect。
  const tabs = useMemo(
    () => (pinned.includes(activeView) || !isPinnableView(activeView) ? pinned : [...pinned, activeView]),
    [pinned, activeView],
  )

  // 打开视图（侧栏点击 / 标签点击）：钉住并导航。
  const openView = useCallback(
    (view: string) => {
      setPinned((prev) => (prev.includes(view) ? prev : [...prev, view]))
      router.push(`/${view}`)
    },
    [router],
  )

  const closeTab = useCallback(
    (view: string) => {
      if (view === HOME_VIEW) return
      setPinned((prev) => {
        const list = prev.includes(view) ? prev : tabs
        const idx = list.indexOf(view)
        const next = list.filter((v) => v !== view)
        // 关闭的是当前视图 → 跳到相邻标签
        if (view === activeView) {
          const fallback = next[idx - 1] ?? next[idx] ?? HOME_VIEW
          router.push(`/${fallback}`)
        }
        return next
      })
    },
    [activeView, router, tabs],
  )

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar activeView={topView} orgName={orgName} userName={userName} userRole={userRole} defaultModel={defaultModel} canManageTenant={canManageTenant} onViewChange={openView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标签条（多窗口）：无顶端边框、无右上角账号菜单（账号操作在左下角侧栏） */}
        <header className="flex items-center px-3 h-11 shrink-0">
          <WindowTabs
            tabs={tabs}
            activeView={activeView}
            titleOf={titleOf}
            homeView={HOME_VIEW}
            onSelect={openView}
            onClose={closeTab}
          />
        </header>

        <main className="flex-1 overflow-auto">
          <TabTitleProvider report={reportTitle}>{children}</TabTitleProvider>
        </main>
      </div>
    </div>
  )
}
