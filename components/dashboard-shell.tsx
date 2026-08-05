'use client'

import { useCallback, useMemo, useState } from 'react'
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
  'platform-keys': 'Key 总览（全平台）',
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

  // 多窗口标签：已「钉住」的视图集合（首页固定在最前）。用处理器增删，避免 effect 内 setState。
  const [pinned, setPinned] = useState<string[]>(() =>
    activeView !== HOME_VIEW && activeView in TITLES ? [HOME_VIEW, activeView] : [HOME_VIEW],
  )

  // 渲染期派生：始终把当前视图并入展示（覆盖页面内的程序化跳转），无需 effect。
  const tabs = useMemo(
    () => (pinned.includes(activeView) || !(activeView in TITLES) ? pinned : [...pinned, activeView]),
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
      <AppSidebar activeView={activeView} orgName={orgName} userName={userName} userRole={userRole} defaultModel={defaultModel} canManageTenant={canManageTenant} onViewChange={openView} />

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

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
