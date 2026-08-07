import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAiActivity } from '@/lib/data/ai-activity'
import { AiActivityView } from '@/components/views/ai-activity-view'

// AI 操作记录（WF-16）。人人可看自己的；看全租户需 audit:read（与安全中心同一把尺子）。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const initial = await listAiActivity(ctx, { limit: 200, onlyMine: true })
  return <AiActivityView initial={initial} canViewAll={can(ctx, 'audit:read')} />
}
