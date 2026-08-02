import { guardExtensionRequest, corsHeaders, handleOptions } from '@/lib/auth/extension-guard'
import { withExtensionIdentity } from '@/lib/auth/extension-context'
import { getAgentForChat } from '@/lib/data/agents'
import { recordCall } from '@/lib/data/call-logs'
import { chatStream, type ChatMessage } from '@/lib/ai'
import { retrieveSegments } from '@/lib/kb/rag'

// V12-8.7 / ADR-020：对外流式对话端点。
// 🔴 本文件禁止 import getRequestContext —— 内外两条身份入口严格分家（ADR-020 §2）。
//
// POST /api/ext/v1/chat
//   Header: Authorization: Bearer <api key>
//   Body:   { messages: [{role, content}], sessionId? }
//   返回:   text/event-stream，事件 delta / done / error

export const runtime = 'nodejs' // AsyncLocalStorage + 自签 JWT 需要 Node 运行时，不能用 Edge

const ROLES = new Set(['user', 'assistant'])
const MAX_HISTORY = 20        // 只取最近 20 条，控上下文长度与成本
const MAX_CONTENT = 4000      // 单条消息字符上限，防灌爆

export async function OPTIONS(req: Request) {
  // 预检时还没验 Key，拿不到该 Key 的白名单。这里回空头（浏览器直连会被挡），
  // 真正的放行发生在 POST——BFF 代理是服务端调用，不发预检，不受影响。
  return handleOptions(req, [])
}

export async function POST(req: Request) {
  const guard = await guardExtensionRequest(req, 'chat')
  if ('response' in guard) return guard.response
  const { ctx, origin } = guard
  const cors = corsHeaders(origin, ctx.allowedOrigins)

  if (ctx.targetType !== 'agent') {
    return Response.json(
      { error: { code: 'unsupported_target', message: '本期仅支持绑定 Agent' } },
      { status: 400, headers: cors },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const raw = Array.isArray(body.messages) ? body.messages : []
  const history: ChatMessage[] = raw
    .filter((m): m is { role: string; content: string } => {
      const mm = m as { role?: unknown; content?: unknown }
      return typeof mm?.role === 'string' && ROLES.has(mm.role) && typeof mm?.content === 'string'
    })
    // system 角色一律丢弃：系统提示由服务端按 Agent 配置注入，绝不采信外部传入
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_CONTENT) }))

  if (history.length === 0) {
    return Response.json(
      { error: { code: 'bad_request', message: '缺少对话内容' } },
      { status: 400, headers: cors },
    )
  }

  // 在机器用户身份下取 Agent 配置 —— RLS 保证只可能拿到本租户的 Agent
  const agent = await withExtensionIdentity(ctx, () => getAgentForChat(ctx.request, ctx.targetId))
  if (!agent) {
    return Response.json(
      { error: { code: 'target_unavailable', message: '目标不可用' } },
      { status: 404, headers: cors },
    )
  }
  // 未发布的 Agent 不对外服务（草稿/待审/停用都挡在外面）
  if (agent.status !== 'published') {
    return Response.json(
      { error: { code: 'target_unavailable', message: '目标未发布' } },
      { status: 403, headers: cors },
    )
  }

  // 🔴 注入知识库上下文——与内部对话（/api/agents/[id]/chat）保持同一套检索逻辑。
  // 少了这一步，租户在后台辛苦上传的知识文件对官网访客完全不起作用：
  // Agent 绑了知识库、库里也有内容，但对外这条路不检索，只能靠 systemPrompt 硬答。
  // 检索走机器用户身份，RLS 保证只可能取到本租户的知识。
  let ragContext = ''
  const lastUserRaw = [...history].reverse().find(m => m.role === 'user')?.content
  const lastUser = typeof lastUserRaw === 'string' ? lastUserRaw : ''
  if (lastUser) {
    try {
      const segs = await withExtensionIdentity(ctx, () =>
        retrieveSegments(ctx.request, lastUser, { agentId: agent.id }),
      )
      if (segs.length) {
        // 对外场景不要求标注 [编号] 来源：访客看到「[1]」这种引用标记只会困惑
        ragContext =
          '\n\n以下是该 Agent 绑定知识库的相关资料，若与问题相关请据此作答，不相关则正常作答：\n' +
          segs.map((sg, i) => `[${i + 1}] 《${sg.filename}》：${sg.snippet}`).join('\n')
      }
    } catch (e) {
      // 检索失败不阻断对话——宁可少点知识也要把话接上
      console.error('[ext/chat] 知识库检索失败，降级为无 RAG 作答:', e)
    }
  }

  const systemPrompt =
    (agent.systemPrompt?.trim() ||
      `你是企业 AI 数字员工「${agent.name}」。${agent.description}\n请围绕职责，用简洁专业的中文回答。`) + ragContext

  const startedAt = Date.now()
  const encoder = new TextEncoder()
  const sse = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const stream = new ReadableStream({
    async start(controller) {
      let tokensIn = 0
      let tokensOut = 0
      let model = agent.model ?? ''
      try {
        for await (const chunk of chatStream(
          [{ role: 'system', content: systemPrompt }, ...history],
          { model: agent.model, temperature: agent.temperature },
        )) {
          if (chunk.delta) controller.enqueue(sse('delta', { text: chunk.delta }))
          if (chunk.usage) { tokensIn = chunk.usage.tokensIn; tokensOut = chunk.usage.tokensOut }
          model = chunk.model
        }
        controller.enqueue(sse('done', { agent: { id: agent.id, name: agent.name }, model }))
        // 调用日志同样落在机器用户身份下，org_id 由 RLS 兜底
        await withExtensionIdentity(ctx, () =>
          recordCall(ctx.request, {
            agentId: agent.id, model, tokensIn, tokensOut,
            latencyMs: Date.now() - startedAt, success: true,
          }),
        ).catch(() => {}) // 日志失败不能影响已经吐给外部的内容
      } catch (e) {
        console.error('[ext/chat] 流式调用失败:', e)
        controller.enqueue(sse('error', { code: 'llm_error', message: '模型调用失败，请稍后重试' }))
        await withExtensionIdentity(ctx, () =>
          recordCall(ctx.request, {
            agentId: agent.id, model: agent.model,
            latencyMs: Date.now() - startedAt, success: false, errorCode: 'llm_error',
          }),
        ).catch(() => {})
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // 关掉 nginx 缓冲，否则流式会被攒成一坨才吐出来
      ...cors,
    },
  })
}
