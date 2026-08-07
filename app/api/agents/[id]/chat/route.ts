import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentForChat } from '@/lib/data/agents'
import { getWorkflow } from '@/lib/data/workflow'
import { executeGraph } from '@/lib/workflow/execute'
import { getSkillById } from '@/lib/data/skills'
import { evaluateSkillCall } from '@/lib/skills/invoke'
import { retrieveSegments } from '@/lib/kb/rag'
import { moderateContent } from '@/lib/agents/moderation'
import { substitutePromptVariables } from '@/lib/agents/prompt'
import { recordCall } from '@/lib/data/call-logs'
import { enforceLlmQuota } from '@/lib/data/quota'
import { chatWithUsage, chatWithTools, type ChatMessage, type FunctionTool } from '@/lib/ai'
import { resolveModelClient } from '@/lib/ai/resolve'
import { getAgentResources } from '@/lib/data/agent-resources'
import { listAgentTools, runToolVersion, type RunnableTool } from '@/lib/tools/run'
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

/**
 * 把任意来源的 JSON Schema 归一化成 Function Calling 要求的参数结构。
 *
 * 🔴 Plugin Tool 的 input_schema 是自由 jsonb，MCP Server 返回的 inputSchema
 * 同样不保证形状——两者都可能缺 `type`。缺了会让部分模型**直接拒绝整个工具列表**，
 * 表现是「工具没被调用」而不是报错，极难定位。
 * 早先只在 Plugin 那侧就地归一化、MCP 侧直接透传，等于同一个坑只填了一半；
 * 抽成共用函数就是为了不让下一处接入再漏一次。
 */
function toFunctionParameters(schema: Record<string, unknown> | undefined) {
  const props = schema?.properties
  return {
    type: 'object' as const,
    properties: (props && typeof props === 'object' ? props : {}) as Record<string, unknown>,
    ...(Array.isArray(schema?.required) ? { required: schema.required as string[] } : {}),
  }
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
  // 配额强制（4.8.2）：QPS 令牌桶 + Token 熔断，超限前置拒绝，不进入模型调用。
  const quota = await enforceLlmQuota(ctx)
  if (!quota.ok) {
    return Response.json({ error: { code: quota.code, message: quota.message } }, { status: quota.status })
  }
  const { id } = await params
  const agent = await getAgentForChat(ctx, id)
  if (!agent) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  // 4.8.5：按租户解析 LLM 客户端（配了用租户供应商/Key，未配回退平台 env）。model 仍以 Agent 选择为准。
  const llmClient = await resolveModelClient(ctx, 'llm')

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

  // 内容审查（输入，v1.14 升级：可配关键词 + AI 语义审查）
  if (agent.moderationEnabled) {
    const mod = await moderateContent(lastUser, {
      level: agent.moderationLevel ?? 'keywords',
      customKeywords: agent.moderationKeywords,
    })
    if (mod.flagged) {
      await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: false, errorCode: 'moderation_blocked' })
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
    await recordCall(ctx, { agentId: agent.id, model: `workflow:${wf.name}`, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: result.status === 'succeeded', errorCode: result.status === 'succeeded' ? undefined : 'workflow_failed' })
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
      await recordCall(ctx, { agentId: agent.id, model: `skill:${skill.name}`, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: check.ok, errorCode: check.ok ? undefined : 'skill_denied' })
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

  // GAP-1：Agent 直挂的 Plugin Tool。
  //
  // 🔴 在此之前这段只读 mcp_servers 表，而 ADR-021 把 MCP 并入 Plugin 后
  // 那张表是 **0 行** —— 库里 161 个已发布 Tool，Agent 一个都够不着。
  // Plugin 体系整套建完了，能力却传导不到对话链路，这就是 GAP-1。
  let pluginTools: RunnableTool[] = []
  let mcpServers: McpServerRecord[] = []
  try {
    const resources = await getAgentResources(ctx, agent.id)
    pluginTools = await listAgentTools(ctx, resources.toolIds)
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

  // 有 Plugin Tool 或直连 MCP Server → 走 Function Calling 路径
  if (pluginTools.length > 0 || mcpServers.length > 0) {
    const tools: FunctionTool[] = []
    // Plugin Tool：函数名前缀 pt__，与 MCP 的 {serverId前6位}__ 区分开，
    // 分发时据此判断走哪条执行路径
    const pluginByName = new Map<string, RunnableTool>()
    for (const t of pluginTools) {
      const qualifiedName = `pt__${t.name}`.slice(0, 64)
      pluginByName.set(qualifiedName, t)
      tools.push({
        type: 'function',
        function: {
          name: qualifiedName,
          // 高风险 Tool 在描述里点明，让模型在调用前更谨慎（PRD §14 的人工确认是另一层）
          description: t.riskLevel === 'high' ? `[高风险] ${t.description}` : t.description,
          parameters: toFunctionParameters(t.inputSchema),
        },
      })
    }
    // mcpServerName → {endpoint, auth_type, auth_config} 映射，工具名带 server 前缀区分
    const toolServerMap = new Map<string, { server: McpServerRecord; originalName: string }>()
    // 工具发现失败的 Server：用于在全部不可用时给出可行动的提示，而非静默降级
    const failedServers: { name: string; reason: string }[] = []

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
              // 🔴 MCP 返回的 inputSchema 同样是自由 JSON Schema，不保证有 type。
              // 这里原先直接透传，漏了 Plugin Tool 那侧早就做过的归一化——
              // 同一个坑填了一半，MCP 路径照样会被模型整体拒绝。
              parameters: toFunctionParameters(t.inputSchema),
            },
          })
        }
      } catch (e) {
        // 🔴 不要静默跳过：发现失败时该 Server 的工具整个消失，对话表现成
        // 「Agent 没有这个能力」，而真因可能只是 Key 没配或地址填错。
        // 之前这里是空 catch，线上排查完全无从下手。
        // 单个 Server 失败仍不阻断对话（其他 Server 与 Plugin Tool 照常可用）。
        const reason = e instanceof Error ? e.message : String(e)
        console.warn(`[chat] MCP Server「${server.name}」工具发现失败，本轮不可用：${reason}`)
        failedServers.push({ name: server.name, reason })
      }
    }

    if (tools.length > 0) {
      const handler = async (toolName: string, args: Record<string, unknown>) => {
        // 按名称前缀分发：pt__ 走 Plugin Tool，{serverId前6位}__ 走 MCP。
        // 🔴 ADR-024 后 mcp_servers 不再是「待下线的旧路径」，而是 MCP 的**唯一**模型
        //    （MCP 不设 Plugin 层，tools 表已无 binding_type='mcp' 记录）。
        //    两条路径并存且都是现行的，谁先查只是分发顺序，不含优先级含义。
        const pt = pluginByName.get(toolName)
        if (pt) {
          const r = await runToolVersion(ctx, pt.versionId, args)
          // 🔴 失败也把结论回给模型而不是抛异常：模型据此可以换个问法或告知用户，
          // 抛出去则整轮对话直接 502，用户只看到「工具调用失败」
          return r.content
        }
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
          { model: agent.model, temperature: agent.temperature, maxIterations: 5, client: llmClient },
        )
        await recordCall(ctx, { agentId: agent.id, model, tokensIn, tokensOut, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: true })
        return Response.json({ reply: content, agent: { id: agent.id, name: agent.name, model, brain: pluginTools.length > 0 ? 'plugin_tools' : 'mcp_direct' } })
      } catch (e) {
        console.error('[chat] MCP Function Calling 失败:', e)
        await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: false, errorCode: 'mcp_error' })
        return Response.json({ error: { code: 'mcp_error', message: 'MCP 工具调用失败，请稍后重试' } }, { status: 502 })
      }
    }

    // 🔴 挂了 MCP Server 却一个工具都没发现出来 → 不要静默降级成普通对话。
    // 静默降级的观感是「这个 Agent 就是不会用工具」，用户无从知道真因是
    // 地址没填 / Key 没配 / 服务连不上，只能反复试。如实说明并指出去哪儿修。
    if (tools.length === 0 && failedServers.length > 0) {
      await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: false, errorCode: 'mcp_unavailable' })
      const detail = failedServers.map((f) => `「${f.name}」${f.reason}`).join('；')
      return Response.json({
        error: {
          code: 'mcp_unavailable',
          message: `该 Agent 依赖的 MCP Server 当前不可用：${detail}。请到「Plugin → MCP」检查该 Server 的 Endpoint 与凭证配置。`,
        },
      }, { status: 502 })
    }
  }

  // 标准 LLM 路径（无工具绑定）
  try {
    const { content, tokensIn, tokensOut, model } = await chatWithUsage(
      [{ role: 'system', content: systemPrompt }, ...history],
      { model: agent.model, temperature: agent.temperature, client: llmClient },
    )
    await recordCall(ctx, { agentId: agent.id, model, tokensIn, tokensOut, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: true })
    // 输出审查（v1.14）：审查 AI 回复内容
    if (agent.moderationEnabled && agent.moderationOutputEnabled) {
      const outMod = await moderateContent(content, {
        level: agent.moderationLevel ?? 'keywords',
        customKeywords: agent.moderationKeywords,
      })
      if (outMod.flagged) {
        return Response.json({ reply: '抱歉，该回复包含不合规内容，已被系统过滤。如有疑问请联系管理员。', agent: { id: agent.id, name: agent.name, moderated: true, outputFiltered: true } })
      }
    }
    return Response.json({ reply: content, agent: { id: agent.id, name: agent.name, model } })
  } catch (e) {
    console.error('[chat] LLM 调用失败:', e)
    await recordCall(ctx, { agentId: agent.id, model: agent.model, latencyMs: Date.now() - startedAt, keySource: llmClient.source, provider: llmClient.provider, success: false, errorCode: 'llm_error' })
    return Response.json({ error: { code: 'llm_error', message: '大模型调用失败，请稍后重试' } }, { status: 502 })
  }
}
