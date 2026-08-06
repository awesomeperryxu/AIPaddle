import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { listAgents } from '@/lib/data/agents'
import { assertAgentName, AgentValidationError } from '@/lib/agents/name'
import { requiresEnterprisePermission, type AgentOrigin } from '@/lib/agents/taxonomy'

// GET /api/agents —— 列出本租户 Agent（RLS 隔离，agent:read 默认所有角色可读）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const agents = await listAgents(ctx)
  return Response.json({ agents })
}

// POST /api/agents —— 创建 Agent。API 级权限校验（ADR-007）：仅 Admin/Developer 可创建，
// User/Auditor → 403（默认拒绝）。租户隔离由请求级客户端 + RLS 兜底（org_id=ctx.orgId）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Agent' } }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  // 与改名共用 assertAgentName：两处各写一份规则必然漂移（此前这里只挡空名、
  // 不挡超长，改名路径则两样都不挡）
  let name: string
  try {
    name = assertAgentName(String(body?.name ?? ''))
  } catch (e) {
    if (e instanceof AgentValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }

  // 4.1.17 / ADR-013：来源分类。origin/mandatory 属高权写操作——设"平台来源"或"强制下发"
  // 须企业级创建权（agent:create:enterprise / 平台超管），防越权把自建 Agent 标为平台内置强制。
  const origin: AgentOrigin = body?.origin === 'platform' ? 'platform' : 'user'
  const mandatory = body?.mandatory === true
  if (requiresEnterprisePermission({ origin, mandatory }) && !can(ctx, 'agent:create:enterprise')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：设置平台来源或强制下发的 Agent' } }, { status: 403 })
  }

  const supabase = await createClient()
  // config 可从 body.config 对象传入；也兼容 systemPrompt 顶级字段（导入脚本等场景）
  let config: Record<string, unknown> | undefined =
    (body?.config && typeof body.config === 'object' && !Array.isArray(body.config))
      ? body.config as Record<string, unknown>
      : undefined
  if (!config && typeof body?.systemPrompt === 'string' && body.systemPrompt.trim()) {
    config = { systemPrompt: body.systemPrompt.trim() }
  } else if (config && !config.systemPrompt && typeof body?.systemPrompt === 'string' && body.systemPrompt.trim()) {
    config = { ...config, systemPrompt: body.systemPrompt.trim() }
  }

  const { data, error } = await supabase
    .from('agents')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name,
      description: typeof body?.description === 'string' ? body.description : null,
      department: typeof body?.department === 'string' ? body.department : null,
      status: 'draft',
      origin,
      mandatory,
      ...(config ? { config } : {}),
    })
    .select('id, name, status')
    .single()

  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ agent: data }, { status: 201 })
}
