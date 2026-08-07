import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById, saveAgent, deleteAgent } from '@/lib/data/agents'
import { AgentValidationError } from '@/lib/agents/name'
import { AgentConfigSchema } from '@/lib/agents/config'
import { detectBrainCycle } from '@/lib/agents/brain'
import { requiresEnterprisePermission, type AgentOrigin } from '@/lib/agents/taxonomy'
import { listDependentDigitalEmployees } from '@/lib/data/de-dependents'

// Next.js 16：动态段 params 为 Promise，必须 await。
type Ctx = { params: Promise<{ id: string }> }

// GET /api/agents/[id] —— 取单个 Agent。租户隔离由 RLS 兜底：
// 他租户的 id 查不到 → 404（不泄露资源是否存在）。对应 S0-ISO-01/03/04 越权读。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const { id } = await params
  const agent = await getAgentById(ctx, id)
  if (!agent) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  return Response.json({ agent })
}

// PATCH /api/agents/[id] —— 更新 Agent。权限：agent:update（Admin/Developer）。
// 跨租户 id 更新影响 0 行 → 404（RLS 兜底），越权写被拦。
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Agent' } }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))

  // 4.1.17 / ADR-013：改动来源分类（origin/mandatory）属高权写操作——设"平台来源"或"强制下发"
  // 须企业级创建权，防越权把自建 Agent 提权为平台内置强制。仅当入参携带这些字段时才做判定。
  const origin: AgentOrigin | undefined = body?.origin === 'platform' ? 'platform' : body?.origin === 'user' ? 'user' : undefined
  const mandatory = typeof body?.mandatory === 'boolean' ? (body.mandatory as boolean) : undefined
  if (requiresEnterprisePermission({ origin, mandatory }) && !can(ctx, 'agent:create:enterprise')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：设置平台来源或强制下发的 Agent' } }, { status: 403 })
  }

  // config 全量编排配置（4.1.7）：Zod 部分校验，失败 422
  let config
  if (body?.config && typeof body.config === 'object') {
    const parsed = AgentConfigSchema.partial().safeParse(body.config)
    if (!parsed.success) {
      return Response.json({ error: { code: 'invalid_config', message: '配置校验失败' }, issues: parsed.error.issues }, { status: 422 })
    }
    config = parsed.data
    // 4.1.9 防环：绑定工作流大脑时，检查不会形成 agent↔workflow 环
    if (config.brainWorkflowId) {
      if (await detectBrainCycle(ctx, id, config.brainWorkflowId)) {
        return Response.json({ error: { code: 'brain_cycle', message: '绑定该工作流会形成循环（工作流内的 Agent 节点最终又指向本 Agent），已拒绝' } }, { status: 422 })
      }
    }
  }

  let agent
  try {
    agent = await saveAgent(ctx, id, {
      name: typeof body?.name === 'string' ? body.name : undefined,
      description: typeof body?.description === 'string' ? body.description : undefined,
      department: typeof body?.department === 'string' ? body.department : undefined,
      origin,
      mandatory,
      config,
    })
  } catch (e) {
    // 名称等入参校验失败 → 422（与 config 校验同档），前端顶栏直接显示该文案
    if (e instanceof AgentValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 422 })
    }
    throw e
  }
  if (!agent) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  return Response.json({ agent })
}

// DELETE /api/agents/[id] —— 软删除 Agent。权限：agent:delete（Admin/Developer）。
// 跨租户 id 影响 0 行 → 404（RLS 兜底），越权删被拦。
export async function DELETE(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 Agent' } }, { status: 403 })
  }
  const { id } = await params

  // 🔴 DE-11：删除前告知会连累谁。
  // DE-8 拦的是「下线」，删除路径此前完全没拦——而删除比下线更彻底：
  // 下线还能重新上线，删除后上级的那个成员就永远回不来了（软删可恢复，但没人会去翻）。
  // 形状与 DE-8 一致：先回 409 + 受影响清单，confirm 后才真删。
  //
  // 已发布的 Agent 本就删不掉（须先下线），所以走到这里的上级多半已被 DE-8
  // 级联下线过；但草稿态的上级不会被级联，仍需在此提醒。
  const deps = await listDependentDigitalEmployees(ctx, id)
  if (deps.length > 0) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    if (body?.confirm !== true) {
      return Response.json(
        {
          error: {
            code: 'has_dependents',
            message: `有 ${deps.length} 个数字员工正把它当下级使用，删除后它们会永久少一个成员。确认请重新提交并带 confirm=true。`,
          },
          affectedDigitalEmployees: deps,
        },
        { status: 409 },
      )
    }
  }

  const result = await deleteAgent(ctx, id)
  if (result === 'published') {
    // 409 而非 404：Agent 确实存在，是**状态**不允许删除，前端据此提示「先下线」
    return Response.json(
      { error: { code: 'conflict', message: '已发布的 Agent 无法删除，请先下线' } },
      { status: 409 },
    )
  }
  if (result === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  return Response.json({ ok: true })
}
