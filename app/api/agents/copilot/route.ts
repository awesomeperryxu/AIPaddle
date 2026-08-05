import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createAgent } from '@/lib/data/agents'
import { setAgentResources } from '@/lib/data/agent-resources'
import { listKnowledgeBases } from '@/lib/data/knowledge'
import { listSkills } from '@/lib/data/skills'
import { writeAudit } from '@/lib/data/audit'
import {
  generateCopilotRaw, sanitizeCopilotResult, AgentDraftSchema,
  type ResourceItem,
} from '@/lib/agents/copilot'

// POST /api/agents/copilot  body: { description }
// Agent Copilot（4.1.6）：描述→AI 生成配置草稿→Schema 校验→落 draft；AI 不能发布；生成留审计。
//
// 🔴 BUG-100（2026-08-05）：此前用旧版 generateAgentDraft，三个缺陷——
//   ① 名字识别错误：prompt 没强调使用用户指定的名称，LLM 自己发挥
//   ② 细节丢失：只传一句 description，用户原文里的具体要求全部丢掉
//   ③ 知识库不关联：旧版根本没有 suggestKbIds 字段
// 修复：切到新版 generateCopilotRaw（传入可用知识库/工具清单 + 返回 suggestKbIds），
// 建好 Agent 后按建议自动绑定知识库。与编排页 Copilot（4.1.13）共用同一套 prompt 和越权过滤。
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Agent' } }, { status: 403 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (description.length < 4) {
    return Response.json({ error: { code: 'bad_request', message: '请多描述一点需求（≥4 字）' } }, { status: 400 })
  }

  // 取本租户可用资源——与编排页 Copilot（4.1.13）共用同一套逻辑和授权清单
  const [skills, kbs] = await Promise.all([listSkills(ctx), listKnowledgeBases(ctx)])
  const authorizedSkills: ResourceItem[] = skills
    .filter((s) => s.status === 'published')
    .map((s) => ({ id: s.id, name: s.name, description: s.description }))
  const authorizedKbs: ResourceItem[] = kbs.map((k) => ({ id: k.id, name: k.name, description: k.description }))

  let draftName: string
  let draftDepartment: string
  let draftDescription: string
  let draftSystemPrompt: string
  let suggestKbIds: string[] = []

  try {
    const raw = await generateCopilotRaw(description, authorizedKbs, authorizedSkills)
    const result = sanitizeCopilotResult(raw, authorizedKbs, authorizedSkills)
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

    // 从新版结果中提取创建 Agent 需要的基础字段
    const parsed = AgentDraftSchema.safeParse({
      name: obj.name ?? description.slice(0, 40),
      department: obj.department ?? '',
      description: typeof obj.description === 'string' ? obj.description : description,
      systemPrompt: result.patch.systemPrompt ?? `你是企业 AI 数字员工。${description}`,
    })
    if (parsed.success) {
      draftName = parsed.data.name
      draftDepartment = parsed.data.department
      draftDescription = parsed.data.description
      draftSystemPrompt = parsed.data.systemPrompt
    } else {
      draftName = description.slice(0, 40)
      draftDepartment = ''
      draftDescription = description
      draftSystemPrompt = result.patch.systemPrompt ?? `你是企业 AI 数字员工。${description}`
    }
    suggestKbIds = result.suggestKbIds
  } catch (e) {
    console.error('[copilot] 生成或校验失败:', e)
    return Response.json(
      { error: { code: 'generation_failed', message: 'AI 生成的配置未通过校验，请调整描述后重试' } },
      { status: 422 },
    )
  }

  // 落 draft（createAgent 强制 status='draft'，AI 无法触发发布）
  const agent = await createAgent(ctx, {
    name: draftName,
    department: draftDepartment,
    description: draftDescription,
    systemPrompt: draftSystemPrompt,
  })

  // 自动关联 LLM 建议的知识库（越权项已被 sanitizeCopilotResult 过滤掉）
  if (suggestKbIds.length > 0) {
    try {
      await setAgentResources(ctx, agent.id, {
        knowledgeBaseIds: suggestKbIds,
        skillIds: [],
        mcpServerIds: [],
      })
    } catch (e) {
      // 关联失败不能阻止 Agent 创建——草稿已建好，用户可以手动关联
      console.error('[copilot] 自动关联知识库失败（Agent 已建，不影响草稿）:', e)
    }
  }

  await writeAudit(ctx, 'agent.copilot_create', 'agent', agent.id, {
    description,
    generated: { name: draftName, department: draftDepartment, description: draftDescription },
    suggestKbIds,
  })

  return Response.json({ agent, draft: { name: draftName, department: draftDepartment, description: draftDescription, systemPrompt: draftSystemPrompt } }, { status: 201 })
}
