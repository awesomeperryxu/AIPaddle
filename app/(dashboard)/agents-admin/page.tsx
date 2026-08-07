import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAgents, getAgentsReadiness } from '@/lib/data/agents'
import { AgentsAdminView } from '@/components/views/agents-admin-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const agents = await listAgents(ctx)
  // 配置完整度：外部导入的 Agent 往往只有提示词、没有能力接线，
  // 不在列表上标出来，用户要点进去才发现是空壳
  const readiness = await getAgentsReadiness(ctx, agents.map((a) => a.id))
  return (
    <AgentsAdminView
      agents={agents}
      readiness={readiness}
      canCreate={can(ctx, 'agent:create')}
      canDelete={can(ctx, 'agent:delete')}
      canEdit={can(ctx, 'agent:update')}
      canSubmit={can(ctx, 'agent:submit')}
      canReview={can(ctx, 'agent:review')}
    />
  )
}
