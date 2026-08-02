import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getPluginById, updatePlugin, deletePlugin, PluginValidationError } from '@/lib/data/plugins'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'plugin:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 Plugin' } }, { status: 403 })
  }
  const { id } = await params
  const plugin = await getPluginById(ctx, id)
  if (!plugin) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ plugin })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'plugin:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改 Plugin' } }, { status: 403 })
  }
  const { id } = await params
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  try {
    const plugin = await updatePlugin(ctx, id, {
      name: typeof b?.name === 'string' ? b.name : undefined,
      description: typeof b?.description === 'string' ? b.description : undefined,
      repo: b?.repo === null || typeof b?.repo === 'string' ? (b.repo as string | null) : undefined,
      license: b?.license === null || typeof b?.license === 'string' ? (b.license as string | null) : undefined,
      docsUrl: b?.docsUrl === null || typeof b?.docsUrl === 'string' ? (b.docsUrl as string | null) : undefined,
    })
    if (!plugin) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    return Response.json({ plugin })
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
  if (!can(ctx, 'plugin:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 Plugin' } }, { status: 403 })
  }
  const { id } = await params
  const r = await deletePlugin(ctx, id)
  // 409 而非 404：资源存在，是状态/依赖不允许删除
  if (r === 'published') {
    return Response.json({ error: { code: 'conflict', message: '已发布的 Plugin 无法删除，请先下线' } }, { status: 409 })
  }
  if (r === 'has_tools') {
    return Response.json(
      { error: { code: 'conflict', message: '该 Plugin 下仍有 Tool，请先删除或迁移这些 Tool' } },
      { status: 409 },
    )
  }
  if (r === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  await writeAudit(ctx, 'plugin.deleted', 'plugin', id, {})
  return Response.json({ ok: true })
}
