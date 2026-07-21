import { getRequestContext } from '@/lib/context'
import { chatStream, type ChatMessage } from '@/lib/ai'
import { retrieveSegments } from '@/lib/kb/rag'
import {
  getOwnedConversation, listMessages, appendMessage, renameConversation,
  type Citation,
} from '@/lib/data/conversations'

type Ctx = { params: Promise<{ id: string }> }
const RAG_MIN_SIMILARITY = 0.3
const HISTORY_LIMIT = 20

const SYSTEM_BASE = `你是 AIPaddle 平台的个人 AI 助理，帮助员工高效完成工作，用简洁专业的简体中文回答。`

// GET /api/assistant/conversations/[id]/messages —— 会话历史
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getOwnedConversation(ctx, id)))
    return Response.json({ error: { code: 'not_found', message: '会话不存在或无权访问' } }, { status: 404 })
  const messages = await listMessages(ctx, id)
  return Response.json({ messages })
}

// POST /api/assistant/conversations/[id]/messages —— 发消息（流式 SSE + 知识库 RAG）
// 先存用户消息 → RAG 检索全员可见知识库 → 流式 qwen（先发 citations 再发 delta）→ 存助手消息。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  if (!(await getOwnedConversation(ctx, id)))
    return Response.json({ error: { code: 'not_found', message: '会话不存在或无权访问' } }, { status: 404 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const content = String(body?.content ?? '').trim()
  if (!content) return Response.json({ error: { code: 'invalid', message: '消息不能为空' } }, { status: 400 })

  // 历史（存用户消息前取，用于判首条 + 组装上下文）
  const prior = await listMessages(ctx, id)
  await appendMessage(ctx, id, { role: 'user', content })
  if (prior.length === 0) await renameConversation(ctx, id, content.slice(0, 24)) // 首条自动命名

  // RAG：检索全员可见知识库
  let citations: Citation[] = []
  let ragContext = ''
  try {
    const segs = (await retrieveSegments(ctx, content)).filter((s) => s.similarity >= RAG_MIN_SIMILARITY)
    if (segs.length) {
      citations = segs.map((s) => ({ documentId: s.documentId, filename: s.filename, snippet: s.snippet, similarity: s.similarity }))
      ragContext =
        '\n\n以下是可能相关的企业知识库资料，若与问题相关请据此作答并在末尾用 [编号] 标注来源，不相关则正常作答：\n' +
        segs.map((s, i) => `[${i + 1}] 《${s.filename}》：${s.snippet}`).join('\n')
    }
  } catch { /* 检索失败不阻断对话 */ }

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_BASE + ragContext },
    ...prior.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: 'user', content },
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        if (citations.length) send({ type: 'citations', citations })
        let full = ''
        let tokensOut = 0
        for await (const chunk of chatStream(llmMessages, { temperature: 0.4 })) {
          if (chunk.delta) {
            full += chunk.delta
            send({ type: 'delta', text: chunk.delta })
          } else if (chunk.usage) {
            tokensOut = chunk.usage.tokensOut
          }
        }
        await appendMessage(ctx, id, { role: 'assistant', content: full, tokens: tokensOut, citations })
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : '生成失败' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
