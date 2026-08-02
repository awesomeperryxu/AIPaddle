import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getToolById, updateTool, deleteTool } from '@/lib/data/tools'
import { PluginValidationError } from '@/lib/data/plugins'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 Tool' } }, { status: 403 })
  }
  const { id } = await params
  const tool = await getToolById(ctx, id)
  if (!tool) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ tool })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Tool' } }, { status: 403 })
  }
  const { id } = await params
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  try {
    const tool = await updateTool(ctx, id, {
      name: typeof b?.name === 'string' ? b.name : undefined,
      displayName: typeof b?.displayName === 'string' ? b.displayName : undefined,
      description: typeof b?.description === 'string' ? b.description : undefined,
      riskLevel: b?.riskLevel,
    })
    if (!tool) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    return Response.json({ tool })
  } catch (e) {
    if (e instanceof PluginValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 Tool' } }, { status: 403 })
  }
  const { id } = await params
  const r = await deleteTool(ctx, id)
  if (r === 'published') {
    return Response.json({ error: { code: 'conflict', message: '已发布的 Tool 无法删除，请先下线' } }, { status: 409 })
  }
  if (r === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  await writeAudit(ctx, 'tool.deleted', 'tool', id, {})
  return Response.json({ ok: true })
}
