import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

// POST /api/agents —— 创建 Agent。API 级权限校验（ADR-007）：仅 Admin/Developer 可创建，
// User/Auditor → 403（默认拒绝）。租户隔离由请求级客户端 + RLS 兜底（org_id=ctx.orgId）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'agent:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Agent' } }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) {
    return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name,
      description: typeof body?.description === 'string' ? body.description : null,
      department: typeof body?.department === 'string' ? body.department : null,
      status: 'draft',
    })
    .select('id, name, status')
    .single()

  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ agent: data }, { status: 201 })
}
