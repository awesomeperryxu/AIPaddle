import { getRequestContext } from '@/lib/context'
import { chatStream, VL_MODEL, type ChatMessage } from '@/lib/ai'
import { parseAttachments, buildDocPreface, buildUserContent } from '@/lib/assistant/attachments'
import { retrieveSegments } from '@/lib/kb/rag'
import { classifyIntent, INTENT_ROUTE, INTENT_LABEL } from '@/lib/assistant/intent'
import { getAgentForChat } from '@/lib/data/agents'
import { getSkillById } from '@/lib/data/skills'
import { evaluateSkillCall } from '@/lib/skills/invoke'
import {
  getOwnedConversation, listMessages, appendMessage, renameConversation,
  type Citation,
} from '@/lib/data/conversations'

function sseOnce(text: string): Response {
  const enc = new TextEncoder()
  const s = new ReadableStream({
    start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`))
      send({ type: 'delta', text })
      send({ type: 'done' })
      controller.close()
    },
  })
  return new Response(s, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  })
}

type Ctx = { params: Promise<{ id: string }> }
const RAG_MIN_SIMILARITY = 0.3
const HISTORY_LIMIT = 20

const SYSTEM_BASE = `你是 AIPaddle 平台的个人 AI 助理，帮助员工高效完成工作，用简洁专业的简体中文回答。
- 你由通义千问（Qwen）大模型驱动。若被问到使用的模型或底层技术，请如实说明"由通义千问（Qwen）驱动"，
  严禁编造"自研大模型""基于飞桨""数据不出域""不调用外部模型"等任何不实说法。
- 不确定的事实（版本号、性能参数、合规/隐私承诺等）绝不杜撰，如实说明你无法确定。`

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
  const agentId = typeof body?.agentId === 'string' ? body.agentId : undefined // @Agent 单条借答（切片3）
  const skillId = typeof body?.skillId === 'string' ? body.skillId : undefined // /Skill 触发试跑（切片3）
  // 附件（#55）：doc 解析文本注入 prompt；image 走多模态 qwen-vl
  const attachments = parseAttachments(body?.attachments)
  const docs = attachments.filter((a) => a.kind === 'doc') as import('@/lib/assistant/attachments').DocAttachment[]
  const images = attachments.filter((a) => a.kind === 'image') as import('@/lib/assistant/attachments').ImageAttachment[]

  // 历史（存用户消息前取，用于判首条 + 组装上下文）
  const prior = await listMessages(ctx, id)
  await appendMessage(ctx, id, { role: 'user', content })
  if (prior.length === 0) await renameConversation(ctx, id, content.slice(0, 24)) // 首条自动命名

  // /Skill：触发该 Skill 试跑并把结果带回对话（切片3）
  if (skillId) {
    const skill = await getSkillById(ctx, skillId)
    if (!skill) return sseOnce('⚠️ 该 Skill 不存在或无权访问。')
    const allowedTools = Array.isArray(skill.config.allowed_tools) ? skill.config.allowed_tools.map(String) : []
    const requestedTool = skill.type === 'MCP' ? allowedTools[0] : undefined
    const check = evaluateSkillCall({ type: skill.type, allowedTools, requestedTool, serverStatus: skill.type === 'MCP' ? 'approved' : undefined })
    const result = check.ok
      ? `已试跑 Skill「${skill.name}」（${skill.type}）\n输入：${content}\n结果（模拟试跑）：Skill「${skill.name}」执行成功，返回处理结果占位。`
      : `Skill「${skill.name}」调用被拒：${check.message}`
    await appendMessage(ctx, id, { role: 'assistant', content: result, citations: [] })
    return sseOnce(result)
  }

  // @Agent：本条用该 Agent 的人设回答（切片3）——跳过意图分类
  let systemPrompt = SYSTEM_BASE
  if (agentId) {
    const agent = await getAgentForChat(ctx, agentId)
    if (!agent) return sseOnce('⚠️ 该 Agent 不存在或无权访问。')
    systemPrompt = agent.systemPrompt?.trim()
      || `你是企业数字员工「${agent.name}」，围绕职责用简洁专业的简体中文回答。你由通义千问（Qwen）驱动，勿编造自研模型或虚假承诺。`
  }

  // 意图分类（切片2）：仅普通对话（无 @Agent/@Skill，且无附件）时判定创建意图；
  // 带附件时用户明确是要总结/分析，跳过创建跳转。
  const intent = (agentId || attachments.length) ? { kind: 'chat' as const, description: '' } : await classifyIntent(content)
  if (intent.kind !== 'chat') {
    const label = INTENT_LABEL[intent.kind]
    const target = INTENT_ROUTE[intent.kind]
    const desc = intent.description || content
    const notice = `我识别到你想创建「${label}」，正在带你去创建页面并预填你的描述…`
    await appendMessage(ctx, id, { role: 'assistant', content: notice, citations: [] })
    const enc = new TextEncoder()
    const s = new ReadableStream({
      start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`))
        send({ type: 'delta', text: notice })
        send({ type: 'redirect', target, kind: intent.kind, description: desc })
        send({ type: 'done' })
        controller.close()
      },
    })
    return new Response(s, {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
    })
  }

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

  // 附件（#55）：文档文本作前言注入本条用户提问；图片走多模态 content 数组。
  const docPreface = buildDocPreface(docs)
  const userText = docPreface ? `${docPreface}\n\n用户的问题：${content}` : content
  const userContent = buildUserContent(userText, images)
  const useVL = images.length > 0

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + ragContext },
    ...prior.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: 'user', content: userContent },
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        if (citations.length) send({ type: 'citations', citations })
        let full = ''
        let tokensOut = 0
        for await (const chunk of chatStream(llmMessages, { temperature: 0.4, model: useVL ? VL_MODEL : undefined })) {
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
