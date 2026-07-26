import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { getPlatformDashboard } from '@/lib/data/platform-dashboard'
import { SaasDashboardView } from '@/components/views/saas-dashboard-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  // 平台运营大盘仅平台超管可见（ADR-010 / 4.8.1）；服务端强制，前端隐藏不算数。
  if (!(await isPlatformAdmin(ctx))) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">平台运营大盘仅平台超管可用</p>
        </div>
      </div>
    )
  }

  const data = await getPlatformDashboard()
  return <SaasDashboardView data={data} />
}
