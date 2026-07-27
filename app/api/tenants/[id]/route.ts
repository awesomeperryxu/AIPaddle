import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import {
  setTenantStatus, deleteTenant, getTenantDetail, updateTenantByPlatform, type TenantPatch,
} from '@/lib/data/tenants'
import { writeAudit } from '@/lib/data/audit'

// GET /api/tenants/[id] —— 租户详情 + 用量统计（仅平台超管，4.8.15a）
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可操作' } }, { status: 403 })
  const { id } = await params
  const tenant = await getTenantDetail(id)
  if (!tenant) return Response.json({ error: { code: 'not_found', message: '租户不存在或已注销' } }, { status: 404 })
  return Response.json({ tenant })
}

// PATCH /api/tenants/[id] —— 停用/启用（ADR-010）+ 基本信息与配额编辑（4.8.15a/b）。仅平台超管。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可操作' } }, { status: 403 })
  const { id } = await params
  const b = await request.json().catch(() => ({} as Record<string, unknown>))

  try {
    if ('status' in b) {
      const status = String(b.status ?? '')
      if (status !== 'active' && status !== 'suspended')
        return Response.json({ error: { code: 'invalid', message: 'status 取值非法' } }, { status: 400 })
      await setTenantStatus(id, status)
      await writeAudit(ctx, 'tenant.status_changed', 'tenant', id, { status })
    }

    // 4.8.15a/b：基本信息 + 配额
    const patch: TenantPatch = {}
    const FIELDS = ['name', 'contactName', 'contactEmail'] as const
    for (const f of FIELDS) {
      if (!(f in b)) continue
      if (f === 'contactName' ? b[f] !== null && typeof b[f] !== 'string' : typeof b[f] !== 'string') {
        return Response.json({ error: { code: 'invalid', message: `${f} 取值非法` } }, { status: 400 })
      }
      ;(patch as Record<string, unknown>)[f] = b[f]
    }
    for (const f of ['tokenQuota', 'storageQuota', 'qpsLimit'] as const) {
      if (!(f in b)) continue
      if (typeof b[f] !== 'number') {
        return Response.json({ error: { code: 'invalid', message: `${f} 必须为数字` } }, { status: 400 })
      }
      patch[f] = b[f] as number
    }

    if (Object.keys(patch).length > 0) {
      await updateTenantByPlatform(id, patch)
      await writeAudit(ctx, 'tenant.updated', 'tenant', id, patch as Record<string, unknown>)
    }

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '操作失败'
    const status = msg.includes('不存在或已注销') ? 404
      : /不能为空|不能超过|格式非法|必须为非负整数/.test(msg) ? 400 : 500
    const code = status === 404 ? 'not_found' : status === 400 ? 'invalid' : 'server_error'
    return Response.json({ error: { code, message: msg } }, { status })
  }
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
