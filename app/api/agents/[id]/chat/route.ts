import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentForChat } from '@/lib/data/agents'
import { getWorkflow } from '@/lib/data/workflow'
import { executeGraph } from '@/lib/workflow/execute'
import { getSkillById } from '@/lib/data/skills'
import { evaluateSkillCall } from '@/lib/skills/invoke'
import { retrieveSegments } from '@/lib/kb/rag'
import { moderateText } from '@/lib/agents/moderation'
import { substitutePromptVariables } from '@/lib/agents/prompt'
import { recordCall } from '@/lib/data/call-logs'
import { chatWithUsage, chatWithTools, type ChatMessage, type FunctionTool } from '@/lib/ai'
import { getAgentResources } from '@/lib/data/agent-resources'
import { createClient } from '@/lib/supabase/server'
import { listMcpTools, callMcpTool } from '@/lib/mcp/client'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

const ROLES = new Set(['user', 'assistant', 'system'])

type McpServerRecord = {
  id: string
  name: string
  endpoint: string
  auth_type: string
  auth_config: Record<string, string>
}

// POST /api/agents/[id]/chat  body: { messages: {role, content}[] }
// LLM 模式若绑定了 approved MCP Server，使用 Function Calling 路径（Path B 直连）。
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
  // 4.1.15：运行期变量值（对话/试聊前用户填的表单），用于替换 systemPrompt 里的 {{变量名}}
  const varValues: Record<string, string> =
    body?.variables && typeof body.variables === 'object'
      ? Object.fromEntries(Object.entries(body.variables as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]))
      : {}
  const history: ChatMessage[] = raw
    .filter((m): m is ChatMessage => {
      const mm = m as Partial<ChatMessage>
      return !!mm && typeof mm.role === 'string' && ROLES.has(mm.role) && typeof mm.content === 'string'
    })
    .filter(m => m.role !== 'system')
    .slice(-20)
  if (history.length === 0) {
    return Response.json({ error: { code: 'bad_request', message: '缺少对话内容' } }, { status: 400 })
  }

  const lastUserContent = [...history].reverse().find((m) => m.role === 'user')?.content
  const lastUser = typeof lastUserContent === 'string' ? lastUserContent : ''
  const startedAt = Date.now()

  // 4.1.12 内容审查（前置）
  if (agent.moderationEnabled) {
    const mod = moderateText(lastUser)
    if (mod.flagged) {
      await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, success: false, errorCode: 'moderation_blocked' })
      return Response.json({ reply: '抱歉，你的请求涉及不合规内容，我无法协助。', agent: { id: agent.id, name: agent.name, moderated: true } })
    }
  }

  // 4.1.9 大脑分流：绑定工作流 → 执行 workflow
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

  // 4.1.9 事项路由
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

  // 4.1.11：注入 RAG 上下文
  let ragContext = ''
  try {
    const segs = await retrieveSegments(ctx, lastUser, { agentId: agent.id })
    if (segs.length) {
      const citeInstr = agent.citationEnabled === false
        ? '若与问题相关请据此作答，不相关则正常作答：'
        : '若与问题相关请据此作答并在末尾用 [编号] 标注来源，不相关则正常作答：'
      ragContext =
        '\n\n以下是该 Agent 绑定知识库的相关资料，' + citeInstr + '\n' +
        segs.map((s, i) => `[${i + 1}] 《${s.filename}》：${s.snippet}`).join('\n')
    }
  } catch { /* 检索失败不阻断对话 */ }

  // 系统提示：优先 Agent 配置的 systemPrompt（4.1.15 先做 {{变量名}} 运行期替换），否则按身份兜底
  const basePrompt = agent.systemPrompt?.trim()
    ? substitutePromptVariables(agent.systemPrompt, varValues)
    : `你是企业 AI 数字员工「${agent.name}」。${agent.description}\n请围绕职责，用简洁专业的中文回答。`
  const systemPrompt = basePrompt + ragContext

  // Path B：检查是否绑定了直连 MCP Server
  let mcpServers: McpServerRecord[] = []
  try {
    const resources = await getAgentResources(ctx, agent.id)
    if (resources.mcpServerIds.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('mcp_servers')
        .select('id,name,endpoint,auth_type,auth_config')
        .in('id', resources.mcpServerIds)
        .eq('status', 'approved')
        .is('deleted_at', null)
      mcpServers = (data ?? []) as McpServerRecord[]
    }
  } catch { /* 获取 MCP Server 失败不阻断对话 */ }

  // 若有直连 MCP Server → 收集工具定义，使用 Function Calling 路径
  if (mcpServers.length > 0) {
    const tools: FunctionTool[] = []
    // mcpServerName → {endpoint, auth_type, auth_config} 映射，工具名带 server 前缀区分
    const toolServerMap = new Map<string, { server: McpServerRecord; originalName: string }>()

    for (const server of mcpServers) {
      try {
        const mcpTools = await listMcpTools(server.endpoint, server.auth_type, server.auth_config ?? {})
        for (const t of mcpTools) {
          // 工具名格式：{serverId_前6位}__{toolName}，确保唯一性
          const qualifiedName = `${server.id.slice(0, 6)}__${t.name}`
          toolServerMap.set(qualifiedName, { server, originalName: t.name })
          tools.push({
            type: 'function',
            function: {
              name: qualifiedName,
              description: `[${server.name}] ${t.description ?? ''}`,
              parameters: t.inputSchema,
            },
          })
        }
      } catch { /* 某个 MCP Server 工具发现失败，跳过 */ }
    }

    if (tools.length > 0) {
      const handler = async (toolName: string, args: Record<string, unknown>) => {
        const mapping = toolServerMap.get(toolName)
        if (!mapping) throw new Error(`未知工具：${toolName}`)
        return callMcpTool(
          mapping.server.endpoint,
          mapping.server.auth_type,
          mapping.server.auth_config ?? {},
          mapping.originalName,
          args,
        )
      }

      try {
        const { content, tokensIn, tokensOut, model } = await chatWithTools(
          [{ role: 'system', content: systemPrompt }, ...history],
          tools,
          handler,
          { model: agent.model, temperature: agent.temperature, maxIterations: 5 },
        )
        await recordCall(ctx, { agentId: agent.id, model, tokensIn, tokensOut, latencyMs: Date.now() - startedAt, success: true })
        return Response.json({ reply: content, agent: { id: agent.id, name: agent.name, model, brain: 'mcp_direct' } })
      } catch (e) {
        console.error('[chat] MCP Function Calling 失败:', e)
        await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, success: false, errorCode: 'mcp_error' })
        return Response.json({ error: { code: 'mcp_error', message: 'MCP 工具调用失败，请稍后重试' } }, { status: 502 })
      }
    }
  }

  // 标准 LLM 路径（无工具绑定）
  try {
    const { content, tokensIn, tokensOut, model } = await chatWithUsage(
      [{ role: 'system', content: systemPrompt }, ...history],
      { model: agent.model, temperature: agent.temperature },
    )
    await recordCall(ctx, { agentId: agent.id, model, tokensIn, tokensOut, latencyMs: Date.now() - startedAt, success: true })
    return Response.json({ reply: content, agent: { id: agent.id, name: agent.name, model } })
  } catch (e) {
    console.error('[chat] LLM 调用失败:', e)
    await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, success: false, errorCode: 'llm_error' })
    return Response.json({ error: { code: 'llm_error', message: '大模型调用失败，请稍后重试' } }, { status: 502 })
  }
}
