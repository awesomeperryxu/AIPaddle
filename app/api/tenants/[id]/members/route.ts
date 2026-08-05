import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/tenants/[id]/members —— 查某租户下的全部成员（仅平台超管）
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可查看' } }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('id,name,email,department,status,created_at')
    .eq('org_id', id)
    .eq('is_service_account', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: { code: 'server_error', message: error.message } }, { status: 500 })

  const members = (data ?? []).map(r => ({
    id: r.id,
    name: r.name ?? '',
    email: r.email ?? '',
    department: r.department ?? '',
    status: r.status ?? 'active',
    createdAt: r.created_at,
  }))

  // 补角色
  const { data: roles } = await admin
    .from('user_roles')
    .select('user_id,role')
    .in('user_id', members.map(m => m.id))
    .is('deleted_at', null)
  const roleMap = new Map<string, string[]>()
  for (const r of roles ?? []) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, [])
    roleMap.get(r.user_id)!.push(r.role)
  }

  return Response.json({
    members: members.map(m => ({ ...m, roles: roleMap.get(m.id) ?? [] })),
  })
}
