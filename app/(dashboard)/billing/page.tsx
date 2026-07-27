import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getBillingSummary } from '@/lib/data/billing'
import { BillingView } from '@/components/views/billing-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  // 账单/用量成本敏感，仅 Admin/Auditor 可见（tenant:read）。
  if (!can(ctx, 'tenant:read')) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">仅 Admin 和 Auditor 可查看账单与用量</p>
        </div>
      </div>
    )
  }

  const summary = await getBillingSummary(ctx)
  return <BillingView data={summary} />
}
