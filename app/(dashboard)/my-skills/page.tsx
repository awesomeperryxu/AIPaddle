import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listSkills } from '@/lib/data/skills'
import { MySkillsWorkspaceView } from '@/components/views/my-skills-workspace-view'

// 我的 Skill：对话式创作工作台（#51）——左列表 + 右 MD 编辑器 + 申请上架。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const skills = await listSkills(ctx)
  return (
    <MySkillsWorkspaceView
      skills={skills}
      canCreate={can(ctx, 'skill:create')}
      canSubmit={can(ctx, 'skill:submit')}
    />
  )
}
