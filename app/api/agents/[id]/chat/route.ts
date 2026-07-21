import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentForChat } from '@/lib/data/agents'
import { chat, type ChatMessage } from '@/lib/ai'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

const ROLES = new Set(['user', 'assistant', 'system'])

// POST /api/agents/[id]/chat  body: { messages: {role, content}[] }
// 接通真实大模型（通义 Qwen，4.1.4）：按 Agent config 的 model/systemPrompt 组装对话，回答与配置相符。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:chat')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：对话' } }, { status: 403 })
  }
  const { id } = await params
  const agent = await getAgentForChat(ctx, id)
  if (!agent) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const raw: unknown[] = Array.isArray(body?.messages) ? (body.messages as unknown[]) : []
  const history: ChatMessage[] = raw
    .filter((m): m is ChatMessage => {
      const mm = m as Partial<ChatMessage>
      return !!mm && typeof mm.role === 'string' && ROLES.has(mm.role) && typeof mm.content === 'string'
    })
    .filter(m => m.role !== 'system') // 系统提示由服务端按 Agent 配置注入，不采信前端
    .slice(-20) // 仅取最近 20 条，控制上下文长度
  if (history.length === 0) {
    return Response.json({ error: { code: 'bad_request', message: '缺少对话内容' } }, { status: 400 })
  }

  // 系统提示：优先 Agent 配置的 systemPrompt，否则按身份兜底 → 保证回答与 Agent 配置相符
  const systemPrompt =
    agent.systemPrompt?.trim() || `你是企业 AI 数字员工「${agent.name}」。${agent.description}\n请围绕职责，用简洁专业的中文回答。`

  try {
    const reply = await chat([{ role: 'system', content: systemPrompt }, ...history], {
      model: agent.model,
      temperature: agent.temperature,
    })
    return Response.json({ reply, agent: { id: agent.id, name: agent.name, model: agent.model } })
  } catch (e) {
    console.error('[chat] LLM 调用失败:', e)
    return Response.json({ error: { code: 'llm_error', message: '大模型调用失败，请稍后重试' } }, { status: 502 })
  }
}
