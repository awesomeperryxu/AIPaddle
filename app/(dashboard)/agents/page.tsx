import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { AgentsView } from '@/components/views/agents-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const [agents, digitalEmployeeIds] = await Promise.all([
    listAgents(ctx).then(list => list.filter(a => a.status === 'published')),
    listDigitalEmployeeIds(ctx),
  ])
  return (
    <AgentsView
      agents={agents}
      digitalEmployeeIds={digitalEmployeeIds}
      canManage={can(ctx, 'agent:create')}
    />
  )
}
