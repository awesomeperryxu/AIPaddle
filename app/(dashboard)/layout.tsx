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
  let userRole = '成员'
  const ctx = await getRequestContext()
  if (ctx) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', ctx.orgId)
      .single()
    orgName = tenant?.name ?? orgName
    // 角色中文（取首个角色；多角色取并集时以最高权展示）
    const ROLE_LABEL: Record<string, string> = { Admin: '管理员', Developer: '开发者', User: '用户', Auditor: '审计员' }
    const top = ['Admin', 'Developer', 'Auditor', 'User'].find((r) => ctx.roles.includes(r as never))
    userRole = (top && ROLE_LABEL[top]) ?? '成员'
  }

  return <DashboardShell userName={userName} userRole={userRole} orgName={orgName}>{children}</DashboardShell>
}
