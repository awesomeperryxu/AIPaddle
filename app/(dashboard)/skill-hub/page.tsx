import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSkills, listInstalledSkillIds } from '@/lib/data/skills'
import { listMyMcpServers } from '@/lib/data/mcp-servers'
import { SkillHubView } from '@/components/views/skill-hub-view'

// Skill Hub（4.3.1）：服务端取真实 Skill + 用户可见的 MCP Server（封装下拉）+ 安装态 + 权限，传给客户端视图。
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
