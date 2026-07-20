import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'

// 登录后系统外壳（侧边栏 + 视图路由）。服务端 auth 守卫；proxy 中间件已做首层拦截，这里兜底。
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userName = (user.user_metadata?.display_name as string) ?? user.email ?? '用户'

  return <DashboardShell userName={userName}>{children}</DashboardShell>
}
