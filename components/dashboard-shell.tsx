'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { WindowTabs } from '@/components/window-tabs'

const TITLES: Record<string, string> = {
  dashboard: '监控',
  'agents-admin': 'Agent 管理',
  'skill-hub': 'Skill Hub',
  security: '安全管理',
  mcp: 'MCP 管理',
  workflows: '工作流管理',
  templates: '模板库',
  assistant: '个人助理',
  agents: '数字员工',
  members: '成员管理',
  'knowledge-admin': '知识库管理',
  tenants: '租户管理',
  knowledge: '知识库问答',
  'office-tools': '办公文件处理',
  'my-skills': '我的 Skill',
  'saas-dashboard': '运营看板',
  keys: 'Key 管理',
  billing: '账单管理',
  settings: '系统设置',
}

const HOME_VIEW = 'dashboard'

function titleOf(view: string) {
  return TITLES[view] ?? view
}

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
  // 用 sessionStorage 持久化——页面刷新/导航不丢失标签。
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
            if (activeView in TITLES) set.add(activeView)
            const list = [HOME_VIEW, ...([...set].filter((v) => v !== HOME_VIEW))]
            return list
          }
        }
      } catch { /* SSR 或 parse 失败 */ }
    }
    return activeView !== HOME_VIEW && activeView in TITLES ? [HOME_VIEW, activeView] : [HOME_VIEW]
  })

  // pinned 变化时持久化到 sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pinned)) } catch { /* ignore */ }
  }, [pinned])

  // 将当前视图的顶级路径提取出来（如 agents-admin/xxx → agents-admin），用于标签匹配
  const topView = activeView.split('/')[0]

  // 渲染期派生：始终把当前视图并入展示（覆盖页面内的程序化跳转），无需 effect。
  const tabs = useMemo(
    () => {
      const viewForTab = topView in TITLES ? topView : activeView
      return pinned.includes(viewForTab) || !(viewForTab in TITLES) ? pinned : [...pinned, viewForTab]
    },
    [pinned, activeView, topView],
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
            activeView={topView in TITLES ? topView : activeView}
            titleOf={titleOf}
            homeView={HOME_VIEW}
            onSelect={openView}
            onClose={closeTab}
          />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
