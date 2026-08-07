import { getRequestContext } from '@/lib/context'
import { switchActiveOrg } from '@/lib/data/user-orgs'
import { writeAudit } from '@/lib/data/audit'

// POST /api/orgs/switch —— 切换当前活跃组织（ADR-025）。
//
// 🔴 不需要业务权限，但**必须校验归属**：active_org_id 决定 RLS 放行哪一家的数据，
// 切到未归属的组织 = 越权。三道防线：这里查归属、DB 触发器兜底、审计留痕。
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const orgId = String(body?.orgId ?? '').trim()
  if (!orgId) return Response.json({ error: { code: 'invalid', message: '缺少组织 id' } }, { status: 400 })
  if (orgId === ctx.orgId) return Response.json({ ok: true, orgId, unchanged: true })

  const r = await switchActiveOrg(ctx, orgId)
  if (!r.ok) {
    const status = r.reason === 'not_member' ? 403 : r.reason === 'suspended' ? 409 : 500
    return Response.json({ error: { code: r.reason, message: r.message } }, { status })
  }

  // 切换是敏感动作：谁、什么时候、从哪切到哪，必须可查
  await writeAudit(ctx, 'org.switched', 'tenant', orgId, { from: ctx.orgId, to: orgId, name: r.name })
  return Response.json({ ok: true, orgId: r.orgId, name: r.name })
}
