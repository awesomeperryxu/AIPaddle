import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { chatStream, type ChatMessage } from '@/lib/ai'
import { SKILL_CHAT_SYSTEM, extractSkillChatDraft } from '@/lib/skills/copilot'

// POST /api/skills/copilot/chat —— 多轮对话式建 Skill（#51 P3，ADR-005）。
// SSE 流：{type:delta}逐块正文 + 信息足够时{type:draft}结构化定稿（前端一键落 draft）。
// CP-02：AI 只起草，不发布；本接口不写库，仅产出草稿供前端确认创建。
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Skill' } }, { status: 403 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const raw = Array.isArray(body?.messages) ? body.messages : []
  const history: ChatMessage[] = raw
    .filter((m: unknown): m is { role: string; content: string } =>
      !!m && typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m: { role: string; content: string }): ChatMessage => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    .slice(-20)
  if (history.length === 0) {
    return Response.json({ error: { code: 'bad_request', message: '消息为空' } }, { status: 400 })
  }

  const messages: ChatMessage[] = [{ role: 'system', content: SKILL_CHAT_SYSTEM }, ...history]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`))
      let full = ''
      try {
        for await (const chunk of chatStream(messages, { temperature: 0.5, maxTokens: 1200 })) {
          if (chunk.delta) {
            full += chunk.delta
            send({ type: 'delta', text: chunk.delta })
          }
        }
        const draft = extractSkillChatDraft(full)
        if (draft) send({ type: 'draft', draft })
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : '生成失败' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
