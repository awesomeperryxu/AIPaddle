import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getGroup, addMessage, listMessages, type GroupMessage } from '@/lib/data/group-chat'
import { listAgents } from '@/lib/data/agents'
import { selectSpeakers, type SpeakParticipant, type CooldownState } from '@/lib/agents/group-speak'
import { POST as agentChatPOST } from '@/app/api/agents/[id]/chat/route'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

const CONTEXT_LIMIT = 10 // 传给数字员工 /chat 的最近群消息条数（控制上下文体积）

// 由 name/description/department 拆出能力域关键词（长度≥2；含名称本体）。
function buildKeywords(name: string, description: string, department?: string): string[] {
  const parts = [name, description, department ?? '']
    .join(' ')
    .split(/[\s,，、。.;；:：/()（）【】\[\]「」·|-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return [...new Set([name, ...parts])]
}

// 从历史消息推导冷却态：每个数字员工上次发言时间戳（毫秒）。
function deriveCooldown(messages: GroupMessage[]): CooldownState {
  const state: CooldownState = {}
  for (const m of messages) {
    if (m.speakerType === 'agent' && m.speakerId && m.createdAt) {
      const ts = Date.parse(m.createdAt)
      if (!Number.isNaN(ts)) state[m.speakerId] = Math.max(state[m.speakerId] ?? 0, ts)
    }
  }
  return state
}

// GET /api/groups/[id]/messages —— 列出群消息。RLS 兜底：他租户/不存在 → 404。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const group = await getGroup(ctx, id)
  if (!group) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  const messages = await listMessages(ctx, id)
  return Response.json({ messages })
}

// POST /api/groups/[id]/messages —— 发消息。权限 agent:chat。
// 流程：落库人类消息 → selectSpeakers（本群有权数字员工 + 冷却态，now 在此层取）
//      → 对选中数字员工调其 /chat（带最近若干条群消息）→ 回复落库标注发言者/reason → 返回新增消息。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:chat')) return Response.json({ error: { code: 'forbidden', message: '无权限：发言' } }, { status: 403 })
  const { id } = await params
  const group = await getGroup(ctx, id)
  if (!group) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const content = String(body?.content ?? '').trim()
  if (!content) return Response.json({ error: { code: 'invalid', message: '消息不能为空' } }, { status: 400 })

  // 1. 落库人类消息
  const humanMsg = await addMessage(ctx, id, { role: 'user', content, speakerType: 'user', speakerId: ctx.userId })

  // 2. 备好本群有权数字员工（group.agentIds 已含 team 展开、且均本租户）+ 关键词
  const agents = await listAgents(ctx)
  const agentById = new Map(agents.map((a) => [a.id, a]))
  const participants: SpeakParticipant[] = group.agentIds
    .map((aid) => agentById.get(aid))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ agentId: a.id, name: a.name, keywords: buildKeywords(a.name, a.description ?? '', a.department) }))

  // 3. 冷却态从历史群消息推导；now 在 API 层取
  const history = await listMessages(ctx, id)
  const cooldownState = deriveCooldown(history)
  const decisions = selectSpeakers({ message: content, participants, cooldownState, now: Date.now() })

  // 4. 传给数字员工的上下文：最近 N 条群消息（人→user / 数字员工→assistant）
  const contextMessages = history.slice(-CONTEXT_LIMIT).map((m) => ({
    role: m.speakerType === 'agent' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }))

  // 5. 逐个数字员工发言 → 落库
  const agentMsgs: GroupMessage[] = []
  for (const d of decisions) {
    let reply = ''
    try {
      const res = await agentChatPOST(
        new Request('http://internal/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: contextMessages }),
        }),
        { params: Promise.resolve({ id: d.agentId }) },
      )
      const j = (await res.json()) as { reply?: string }
      reply = typeof j?.reply === 'string' ? j.reply : ''
    } catch {
      reply = ''
    }
    if (!reply) continue
    const saved = await addMessage(ctx, id, {
      role: 'assistant',
      content: reply,
      speakerType: 'agent',
      speakerId: d.agentId,
      reason: d.reason,
    })
    agentMsgs.push(saved)
  }

  return Response.json({ messages: [humanMsg, ...agentMsgs] }, { status: 201 })
}
