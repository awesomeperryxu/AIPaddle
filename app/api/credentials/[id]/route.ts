import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getCredentialById, updateCredential, deleteCredential } from '@/lib/data/credentials'
import { PluginValidationError } from '@/lib/data/plugins'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'credential:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看凭证' } }, { status: 403 })
  }
  const { id } = await params
  const credential = await getCredentialById(ctx, id)
  if (!credential) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  return Response.json({ credential })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'credential:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：修改凭证' } }, { status: 403 })
  }
  const { id } = await params
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  try {
    const credential = await updateCredential(ctx, id, {
      name: typeof b?.name === 'string' ? b.name : undefined,
      description: typeof b?.description === 'string' ? b.description : undefined,
      secret: typeof b?.secret === 'string' ? b.secret : undefined,
      meta: b?.meta,
      expiresAt: b?.expiresAt === null || typeof b?.expiresAt === 'string' ? (b.expiresAt as string | null) : undefined,
      enabled: typeof b?.enabled === 'boolean' ? b.enabled : undefined,
    })
    if (!credential) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
    // 换密属高危操作，单独留痕（只记事实，不记值）
    if (typeof b?.secret === 'string' && b.secret.trim()) {
      await writeAudit(ctx, 'credential.rotated', 'credential', id, { name: credential.name })
    }
    return Response.json({ credential })
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
  if (!can(ctx, 'credential:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除凭证' } }, { status: 403 })
  }
  const { id } = await params
  const r = await deleteCredential(ctx, id)
  if (r === 'in_use') {
    // 409：删掉会让线上 Tool 静默失效，且失效原因在调用链里看不出来
    return Response.json(
      { error: { code: 'conflict', message: '该凭证正被 Tool 使用，请先解绑再删除' } },
      { status: 409 },
    )
  }
  if (r === 'not_found') {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }
  await writeAudit(ctx, 'credential.deleted', 'credential', id, {})
  return Response.json({ ok: true })
}
