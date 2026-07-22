import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentDetail } from '@/lib/data/agents'
import { AgentOrchestrateView } from '@/components/views/agent-orchestrate-view'

// Agent 编排页（4.1.7）：嵌入 dashboard 外壳，服务端加载真实 config。
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const agent = await getAgentDetail(ctx, id)
  if (!agent) notFound()

  return <AgentOrchestrateView agent={agent} canEdit={can(ctx, 'agent:update')} />
}
