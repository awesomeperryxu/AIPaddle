import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSchedules } from '@/lib/data/agent-schedules'
import { AgentSchedulesView } from '@/components/views/agent-schedules-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const schedules = await listSchedules(ctx)
  return (
    <AgentSchedulesView
      schedules={schedules}
      canEdit={can(ctx, 'agent:update')}
    />
  )
}
