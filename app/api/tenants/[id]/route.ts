import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { setTenantStatus } from '@/lib/data/tenants'

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
  return Response.json({ ok: true })
}
