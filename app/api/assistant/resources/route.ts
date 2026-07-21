import { getRequestContext } from '@/lib/context'
import { listAgents } from '@/lib/data/agents'
import { listSkills } from '@/lib/data/skills'
import { listKnowledgeBases } from '@/lib/data/knowledge'

// GET /api/assistant/resources —— 个人助理可调取的资源（切片3）：
// 已发布 Agent（@ 借答）、已发布 Skill（/ 试跑）、知识库（展示）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const [agents, skills, kbs] = await Promise.all([
    listAgents(ctx),
    listSkills(ctx),
    listKnowledgeBases(ctx),
  ])

  return Response.json({
    agents: agents.filter((a) => a.status === 'published').map((a) => ({ id: a.id, name: a.name })),
    skills: skills.filter((s) => s.status === 'published').map((s) => ({ id: s.id, name: s.name })),
    knowledgeBases: kbs.map((k) => ({ id: k.id, name: k.name, documentCount: k.documentCount })),
  })
}
