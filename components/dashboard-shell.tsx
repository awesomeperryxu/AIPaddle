'use client'

import { usePathname, useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { signOut } from '@/app/(dashboard)/actions'

const TITLES: Record<string, string> = {
  dashboard: '监控',
  'agents-admin': 'Agent 管理',
  'skill-hub': 'Skill Hub',
  security: '安全管理',
  workflows: '工作流管理',
  assistant: '个人助理',
  agents: '数字员工',
  members: '成员管理',
  'knowledge-admin': '知识库管理',
  tenants: '租户管理',
  knowledge: '知识库问答',
  'my-skills': '我的 Skill',
  'saas-dashboard': '运营看板',
  keys: 'Key 管理',
  billing: '账单管理',
  settings: '系统设置',
}

export function DashboardShell({
  userName,
  orgName = '—',
  children,
}: {
  userName: string
  orgName?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const activeView = pathname.replace(/^\//, '') || 'dashboard'

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar activeView={activeView} orgName={orgName} onViewChange={(href) => router.push(`/${href}`)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-6 h-12 shrink-0">
          <h2 className="text-sm font-medium text-foreground">{TITLES[activeView] ?? ''}</h2>

          <details className="relative">
            <summary
              data-testid="user-menu"
              className="flex items-center gap-2 cursor-pointer list-none rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"
            >
              {userName}
              <span className="opacity-50">▾</span>
            </summary>
            <div
              role="menu"
              className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-popover p-1 shadow-xl z-50"
            >
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full text-left rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  退出登录
                </button>
              </form>
            </div>
          </details>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
