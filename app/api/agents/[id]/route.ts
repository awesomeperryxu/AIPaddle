import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getAgentById, updateAgent, deleteAgent } from '@/lib/data/agents'

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
  const patch = {
    name: typeof body?.name === 'string' ? body.name : undefined,
    description: typeof body?.description === 'string' ? body.description : undefined,
    department: typeof body?.department === 'string' ? body.department : undefined,
  }
  const agent = await updateAgent(ctx, id, patch)
  if (!agent) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  return Response.json({ agent })
}

// DELETE /api/agents/[id] —— 软删除 Agent。权限：agent:delete（Admin/Developer）。
// 跨租户 id 影响 0 行 → 404（RLS 兜底），越权删被拦。
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 Agent' } }, { status: 403 })
  }
  const { id } = await params
  const ok = await deleteAgent(ctx, id)
  if (!ok) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  return Response.json({ ok: true })
}
