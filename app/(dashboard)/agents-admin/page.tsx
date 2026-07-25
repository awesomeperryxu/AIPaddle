import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAgents } from '@/lib/data/agents'
import { listDigitalEmployeeIds } from '@/lib/data/agent-resources'
import { AgentsAdminView } from '@/components/views/agents-admin-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const [agents, digitalEmployeeIds] = await Promise.all([listAgents(ctx), listDigitalEmployeeIds(ctx)])
  return (
    <AgentsAdminView
      agents={agents}
      digitalEmployeeIds={digitalEmployeeIds}
      canCreate={can(ctx, 'agent:create')}
      canDelete={can(ctx, 'agent:delete')}
      canEdit={can(ctx, 'agent:update')}
      canSubmit={can(ctx, 'agent:submit')}
      canReview={can(ctx, 'agent:review')}
    />
  )
}
