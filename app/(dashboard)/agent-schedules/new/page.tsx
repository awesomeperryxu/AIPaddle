import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { AgentScheduleNewView } from '@/components/views/agent-schedule-new-view'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string }>
}) {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  if (!can(ctx, 'agent:update')) redirect('/agent-schedules')

  const sp = await searchParams
  const [agents, deIds] = await Promise.all([
    listAgents(ctx).then(list => list.filter(a => a.status === 'published')),
    listDigitalEmployeeIds(ctx),
  ])

  return (
    <AgentScheduleNewView
      agents={agents}
      digitalEmployeeIds={deIds}
      defaultAgentId={sp.agentId ?? null}
    />
  )
}
