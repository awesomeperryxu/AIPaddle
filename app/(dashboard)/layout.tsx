import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/lib/context'
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

  // 真实租户名（RLS 只允许读本租户，天然隔离；替换侧边栏原硬编码占位名"示范科技"）
  let orgName = '—'
  const ctx = await getRequestContext()
  if (ctx) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', ctx.orgId)
      .single()
    orgName = tenant?.name ?? orgName
  }

  return <DashboardShell userName={userName} orgName={orgName}>{children}</DashboardShell>
}
