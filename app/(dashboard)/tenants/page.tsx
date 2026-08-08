import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllTenants } from '@/lib/data/tenants'
import { getTenantUsage } from '@/lib/data/platform-dashboard'
import { getOrgMemberStats } from '@/lib/data/org-membership-stats'
import { TenantsView } from '@/components/views/tenants-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  // 平台租户管理仅平台超管可见（ADR-010）；服务端强制，前端隐藏不算数
  if (!(await isPlatformAdmin(ctx))) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">平台租户管理仅平台超管可用</p>
        </div>
      </div>
    )
  }

  // 🔴 总用户数不能用各租户成员数相加：跨组织的人会被算两遍。
  // 去重人数与重叠人数由 getOrgMemberStats 单独给（ADR-025）。
  const [tenants, initialUsage, memberStats] = await Promise.all([
    listAllTenants(), getTenantUsage(), getOrgMemberStats(),
  ])
  return <TenantsView tenants={tenants} canManage initialUsage={initialUsage} memberStats={memberStats} />
}
