import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { setTenantStatus, deleteTenant } from '@/lib/data/tenants'
import { writeAudit } from '@/lib/data/audit'

// PATCH /api/tenants/[id] —— 停用/启用租户（仅平台超管，ADR-010）。body: { status }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可操作' } }, { status: 403 })
  const { id } = await params
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  const status = String(b?.status ?? '')
  if (status !== 'active' && status !== 'suspended')
    return Response.json({ error: { code: 'invalid', message: 'status 取值非法' } }, { status: 400 })
  await setTenantStatus(id, status)
  await writeAudit(ctx, 'tenant.status_changed', 'tenant', id, { status })
  return Response.json({ ok: true })
}

// DELETE /api/tenants/[id] —— 注销租户（软删，仅平台超管，4.8.9）。
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可操作' } }, { status: 403 })
  const { id } = await params
  const ok = await deleteTenant(id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: '租户不存在或已注销' } }, { status: 404 })
  await writeAudit(ctx, 'tenant.deleted', 'tenant', id, {})
  return Response.json({ ok: true })
}
