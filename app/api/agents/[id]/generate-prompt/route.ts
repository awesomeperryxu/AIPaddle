import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById } from '@/lib/data/agents'
import { chat } from '@/lib/ai'

type Ctx = { params: Promise<{ id: string }> }

const GEN_SYSTEM = `你是企业 AI 平台的 Agent 提示词专家。根据用户的一句话需求，生成一段高质量的系统提示词（systemPrompt）。
要求：中文；写明角色定位、职责边界、语气风格、输出规范；简洁专业，可直接用作 Agent 的系统提示词。
只输出提示词正文本身，不要任何解释、标题或代码块围栏。`

// POST /api/agents/[id]/generate-prompt  body: { instruction } —— AI 生成系统提示词（4.1.7）。
// 权限 agent:update；只产出提示词文本，不含发布动作。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'agent:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Agent' } }, { status: 403 })
  }
  const { id } = await params
  if (!(await getAgentById(ctx, id))) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const instruction = String(body?.instruction ?? '').trim()
  if (instruction.length < 2) {
    return Response.json({ error: { code: 'bad_request', message: '请先输入需求描述（≥2 字）' } }, { status: 400 })
  }
  try {
    const text = await chat(
      [{ role: 'system', content: GEN_SYSTEM }, { role: 'user', content: instruction }],
      { temperature: 0.5, maxTokens: 800 },
    )
    return Response.json({ systemPrompt: text.trim() })
  } catch {
    return Response.json({ error: { code: 'llm_error', message: '生成失败，请稍后重试' } }, { status: 502 })
  }
}
