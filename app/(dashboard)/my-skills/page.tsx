import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSkills, listInstalledSkillIds } from '@/lib/data/skills'
import { listMyMcpServers } from '@/lib/data/mcp-servers'
import { SkillHubView } from '@/components/views/skill-hub-view'

// 我的 Skill：与 Skill Hub 同一视图（内部「我的 Skill」页签按已安装过滤）。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const [skills, installedIds, mcpServers] = await Promise.all([
    listSkills(ctx),
    listInstalledSkillIds(ctx),
    listMyMcpServers(ctx),
  ])
  return (
    <SkillHubView
      skills={skills}
      installedIds={installedIds}
      mcpServers={mcpServers.map((s) => ({ id: s.id, name: s.name }))}
      canCreate={can(ctx, 'skill:create')}
      canReview={can(ctx, 'skill:review')}
    />
  )
}
