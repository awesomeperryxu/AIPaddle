import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentForChat } from '@/lib/data/agents'
import { getWorkflow } from '@/lib/data/workflow'
import { executeGraph } from '@/lib/workflow/execute'
import { getSkillById } from '@/lib/data/skills'
import { evaluateSkillCall } from '@/lib/skills/invoke'
import { retrieveSegments } from '@/lib/kb/rag'
import { recordCall } from '@/lib/data/call-logs'
import { chatWithUsage, type ChatMessage } from '@/lib/ai'

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

  const lastUserContent = [...history].reverse().find((m) => m.role === 'user')?.content
  const lastUser = typeof lastUserContent === 'string' ? lastUserContent : ''
  const startedAt = Date.now()

  // 4.1.9 大脑分流：绑定工作流 → 执行 workflow；事项路由 → 命中关键词转 Skill；否则走 LLM。
  if (agent.brainMode === 'workflow' && agent.brainWorkflowId) {
    const wf = await getWorkflow(ctx, agent.brainWorkflowId)
    if (!wf) {
      return Response.json({ reply: '⚠️ 该 Agent 绑定的工作流不存在或已删除，请到编排页重新配置。', agent: { id: agent.id, name: agent.name } })
    }
    const result = await executeGraph(wf.graph, lastUser, { ctx })
    await recordCall(ctx, { agentId: agent.id, model: `workflow:${wf.name}`, latencyMs: Date.now() - startedAt, success: result.status === 'succeeded', errorCode: result.status === 'succeeded' ? undefined : 'workflow_failed' })
    const reply = result.status === 'succeeded' ? (result.output || '（工作流未产生输出）') : `⚠️ 工作流执行失败：${result.traces.find((t) => t.status === 'failed')?.error ?? '未知错误'}`
    return Response.json({ reply, agent: { id: agent.id, name: agent.name, brain: 'workflow' } })
  }

  if (agent.brainMode === 'routing' && Array.isArray(agent.routingRules) && agent.routingRules.length > 0) {
    const hit = agent.routingRules.find((r) => r.keyword && lastUser.includes(r.keyword))
    if (hit) {
      const skill = await getSkillById(ctx, hit.skillId)
      if (!skill) {
        return Response.json({ reply: `⚠️ 事项「${hit.keyword}」路由的 Skill 不存在或已下线，请到编排页更新路由。`, agent: { id: agent.id, name: agent.name } })
      }
      const allowedTools = Array.isArray(skill.config.allowed_tools) ? skill.config.allowed_tools.map(String) : []
      const check = evaluateSkillCall({ type: skill.type, allowedTools, requestedTool: skill.type === 'MCP' ? allowedTools[0] : undefined, serverStatus: skill.type === 'MCP' ? 'approved' : undefined })
      await recordCall(ctx, { agentId: agent.id, model: `skill:${skill.name}`, latencyMs: Date.now() - startedAt, success: check.ok, errorCode: check.ok ? undefined : 'skill_denied' })
      const reply = check.ok
        ? `已按事项「${hit.keyword}」路由到 Skill「${skill.name}」（${skill.type}）。\n输入：${lastUser}\n结果（模拟试跑）：执行成功，返回处理结果占位。`
        : `Skill「${skill.name}」调用被拒：${check.message}`
      return Response.json({ reply, agent: { id: agent.id, name: agent.name, brain: 'routing' } })
    }
    // 未命中路由 → 落回 LLM
  }

  // 4.1.11：注入 Agent 直挂知识库的 RAG 上下文（按 agentId 取绑定 KB）
  let ragContext = ''
  try {
    const segs = await retrieveSegments(ctx, lastUser, { agentId: agent.id })
    if (segs.length) {
      ragContext =
        '\n\n以下是该 Agent 绑定知识库的相关资料，若与问题相关请据此作答并在末尾用 [编号] 标注来源，不相关则正常作答：\n' +
        segs.map((s, i) => `[${i + 1}] 《${s.filename}》：${s.snippet}`).join('\n')
    }
  } catch { /* 检索失败不阻断对话 */ }

  // 系统提示：优先 Agent 配置的 systemPrompt，否则按身份兜底 → 保证回答与 Agent 配置相符
  const systemPrompt =
    (agent.systemPrompt?.trim() || `你是企业 AI 数字员工「${agent.name}」。${agent.description}\n请围绕职责，用简洁专业的中文回答。`) + ragContext

  try {
    const { content, tokensIn, tokensOut, model } = await chatWithUsage(
      [{ role: 'system', content: systemPrompt }, ...history],
      { model: agent.model, temperature: agent.temperature },
    )
    // 4.1.5：落调用日志（成功）
    await recordCall(ctx, {
      agentId: agent.id,
      model,
      tokensIn,
      tokensOut,
      latencyMs: Date.now() - startedAt,
      success: true,
    })
    return Response.json({ reply: content, agent: { id: agent.id, name: agent.name, model } })
  } catch (e) {
    console.error('[chat] LLM 调用失败:', e)
    // 4.1.5：落调用日志（失败）
    await recordCall(ctx, {
      agentId: agent.id,
      model: agent.model,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorCode: 'llm_error',
    })
    return Response.json({ error: { code: 'llm_error', message: '大模型调用失败，请稍后重试' } }, { status: 502 })
  }
}
