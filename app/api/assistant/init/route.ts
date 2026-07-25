import { getRequestContext } from '@/lib/context'
import { listConversations, listMessages } from '@/lib/data/conversations'
import { listAgents } from '@/lib/data/agents'
import { listSkills } from '@/lib/data/skills'
import { listKnowledgeBases } from '@/lib/data/knowledge'

// GET /api/assistant/init —— 页面初始化一次性取全量数据，消除前端多个并行请求。
// 并行取：会话列表 + 可用 Agent/Skill/知识库；再串行取第一条会话的历史消息。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const [conversations, agents, skills, kbs] = await Promise.all([
    listConversations(ctx),
    listAgents(ctx),
    listSkills(ctx),
    listKnowledgeBases(ctx),
  ])

  const resources = {
    agents: agents.filter((a) => a.status === 'published').map((a) => ({ id: a.id, name: a.name })),
    skills: skills.filter((s) => s.status === 'published').map((s) => ({ id: s.id, name: s.name })),
    knowledgeBases: kbs.map((k) => ({ id: k.id, name: k.name, documentCount: k.documentCount })),
  }

  let firstMessages: unknown[] = []
  let firstConversationId: string | null = null
  if (conversations.length > 0) {
    firstConversationId = conversations[0].id
    firstMessages = await listMessages(ctx, conversations[0].id)
  }

  return Response.json({ conversations, firstConversationId, firstMessages, resources })
}
