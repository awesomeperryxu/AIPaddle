import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllTenants } from '@/lib/data/tenants'
import { getTenantUsage, getPlatformDashboard } from '@/lib/data/platform-dashboard'
import { isPlatformMetric } from '@/lib/platform-metrics'
import { PlatformMetricDetailView } from '@/components/views/platform-metric-detail-view'

// 平台汇总卡点击 → 独立明细页（/tenants 与 /saas-dashboard 共用）。
// ADR-008：server 组件只调 lib/data/*，把可序列化真实数据交给 client 视图渲染。
// ADR-010：平台超管门控在服务端强制，前端隐藏不算数。
export default async function Page({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  if (!(await isPlatformAdmin(ctx))) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">平台指标明细仅平台超管可用</p>
        </div>
      </div>
    )
  }

  if (!isPlatformMetric(metric)) notFound()

  const [tenants, usage] = await Promise.all([listAllTenants(), getTenantUsage()])
  // 仅 cost/tokens 需要额外的模型成本结构 / Token 趋势，其余指标不多拉一次聚合
  const dashboard = metric === 'cost' || metric === 'tokens' ? await getPlatformDashboard() : null

  return (
    <PlatformMetricDetailView
      metric={metric}
      tenants={tenants.map((t) => ({ id: t.id, name: t.name, status: t.status, createdAt: t.createdAt }))}
      usage={usage}
      modelCost={dashboard?.modelCost}
      tokenTrend={dashboard?.tokenTrend}
    />
  )
}
