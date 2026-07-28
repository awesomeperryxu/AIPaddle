import { checkPassword } from '@/lib/auth/password'
import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllTenants, provisionTenant } from '@/lib/data/tenants'

// GET /api/tenants —— 平台全部租户（仅平台超管，ADR-010）
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可访问' } }, { status: 403 })
  const tenants = await listAllTenants()
  return Response.json({ tenants })
}

// POST /api/tenants —— 开通新租户（仅平台超管）
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可开通租户' } }, { status: 403 })
  const b = await request.json().catch(() => ({} as Record<string, unknown>))

  // 4.8.18：开通企业时同时创建该企业 Admin 账号，密码由开通人指定。
  // 密码只透传给 Auth，不落业务库、不进审计、不回前端。
  const adminPassword = typeof b?.adminPassword === 'string' ? b.adminPassword : ''
  const pwdErr = checkPassword(adminPassword)
  if (pwdErr) return Response.json({ error: { code: 'invalid', message: `管理员${pwdErr}` } }, { status: 400 })

  try {
    const tenant = await provisionTenant({
      name: String(b?.name ?? ''),
      code: String(b?.code ?? ''),
      contactName: String(b?.contactName ?? ''),
      contactEmail: String(b?.contactEmail ?? ''),
      tokenQuota: Number(b?.tokenQuota),
      adminPassword,
    })
    return Response.json({ tenant }, { status: 201 })
  } catch (e) {
    return Response.json(
      { error: { code: 'invalid', message: e instanceof Error ? e.message : '开通失败' } },
      { status: 400 },
    )
  }
}
