import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createAgent } from '@/lib/data/agents'
import { writeAudit } from '@/lib/data/audit'
import { generateAgentDraft } from '@/lib/agents/copilot'

// POST /api/agents/copilot  body: { description }
// Agent Copilot（4.1.6）：描述→AI 生成配置草稿→Schema 校验→落 draft；AI 不能发布；生成留审计。
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

  let draft
  try {
    draft = await generateAgentDraft(description)
  } catch (e) {
    console.error('[copilot] 生成或校验失败:', e)
    return Response.json(
      { error: { code: 'generation_failed', message: 'AI 生成的配置未通过校验，请调整描述后重试' } },
      { status: 422 },
    )
  }

  // 落 draft（createAgent 强制 status='draft'，AI 无法触发发布）
  const agent = await createAgent(ctx, {
    name: draft.name,
    department: draft.department,
    description: draft.description,
    systemPrompt: draft.systemPrompt,
  })
  await writeAudit(ctx, 'agent.copilot_create', 'agent', agent.id, { description, generated: draft })

  return Response.json({ agent, draft }, { status: 201 })
}
