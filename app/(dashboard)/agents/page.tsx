import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { listAgents } from '@/lib/data/agents'
import { AgentsView } from '@/components/views/agents-view'

// 数字员工：只对话已发布的 Agent
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const agents = (await listAgents(ctx)).filter(a => a.status === 'published')
  return <AgentsView agents={agents} />
}
