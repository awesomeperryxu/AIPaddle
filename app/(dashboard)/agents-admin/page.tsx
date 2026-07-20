import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAgents } from '@/lib/data/agents'
import { AgentsAdminView } from '@/components/views/agents-admin-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const agents = await listAgents(ctx)
  return <AgentsAdminView agents={agents} canCreate={can(ctx, 'agent:create')} />
}
