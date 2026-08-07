import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  getExtensionById, updateExtension, deleteExtension, ExtensionValidationError,
} from '@/lib/data/extensions'
import { writeAudit } from '@/lib/data/audit'

// V12-8.10：单个 Extension 的读 / 改 / 删（内部管理接口）。
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看扩展能力' } }, { status: 403 })
  }
  const { id } = await params
  const ext = await getExtensionById(ctx, id)
  if (!ext) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ extension: ext })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改扩展能力' } }, { status: 403 })
  }
  const { id } = await params
  const b = await req.json().catch(() => ({} as Record<string, unknown>))

  try {
    const ext = await updateExtension(ctx, id, {
      name: typeof b?.name === 'string' ? b.name : undefined,
      description: typeof b?.description === 'string' ? b.description : undefined,
      allowedOrigins: b?.allowedOrigins,
      rateLimitPerMin: typeof b?.rateLimitPerMin === 'number' ? b.rateLimitPerMin : undefined,
      targetId: typeof b?.targetId === 'string' ? b.targetId : undefined,
      targetVersion: b?.targetVersion === null || typeof b?.targetVersion === 'string'
        ? (b.targetVersion as string | null) : undefined,
    })
    if (!ext) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    // 改来源白名单/限流会直接影响对外可访问性，留痕
    if (b?.allowedOrigins !== undefined || b?.rateLimitPerMin !== undefined) {
      await writeAudit(ctx, 'extension.governance_updated', 'extension', id, {
        allowedOrigins: ext.allowedOrigins, rateLimitPerMin: ext.rateLimitPerMin,
      })
    }
    return Response.json({ extension: ext })
  } catch (e) {
    if (e instanceof ExtensionValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除扩展能力' } }, { status: 403 })
  }
  const { id } = await params
  const result = await deleteExtension(ctx, id)

  if (result === 'published') {
    // 409 而非 404：资源存在，是状态不允许——外部还在调用时删掉会让接入方毫无预警断流
    return Response.json(
      { error: { code: 'conflict', message: '已发布的扩展能力无法删除，请先下线' } },
      { status: 409 },
    )
  }
  if (result === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  await writeAudit(ctx, 'extension.deleted', 'extension', id, {})
  return Response.json({ ok: true })
}
