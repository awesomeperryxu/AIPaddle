import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById } from '@/lib/data/agents'
import { listSkills } from '@/lib/data/skills'
import { listKnowledgeBases } from '@/lib/data/knowledge'
import { generateCopilotRaw, sanitizeCopilotResult, type ResourceItem } from '@/lib/agents/copilot'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/agents/[id]/copilot —— 生成主控（4.1.13）+ 权限门控资源匹配（4.1.14）。
// body: { instruction, current? }。权限 agent:update。
// 服务端只把「本租户已发布」的 Skill/知识库作为授权可选集喂给 LLM；越权项服务端拦截，不信前端。
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

  // 授权可选集：本租户已发布 Skill（含 MCP 型经 Skill 封装）+ 知识库。RLS 已按租户隔离。
  const [skills, kbs] = await Promise.all([listSkills(ctx), listKnowledgeBases(ctx)])
  const authorizedSkills: ResourceItem[] = skills
    .filter((s) => s.status === 'published')
    .map((s) => ({ id: s.id, name: s.name, description: s.description }))
  const authorizedKbs: ResourceItem[] = kbs.map((k) => ({ id: k.id, name: k.name, description: k.description }))

  try {
    const raw = await generateCopilotRaw(instruction, authorizedKbs, authorizedSkills, body?.current)
    const result = sanitizeCopilotResult(raw, authorizedKbs, authorizedSkills)
    return Response.json(result)
  } catch {
    return Response.json({ error: { code: 'llm_error', message: '生成失败，请稍后重试' } }, { status: 502 })
  }
}
