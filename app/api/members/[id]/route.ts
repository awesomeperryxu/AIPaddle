import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { updateMemberRole, setMemberStatus } from '@/lib/data/members'
import type { Member } from '@/lib/mock-data'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'member:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理成员' } }, { status: 403 })

  const { id: userId } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  try {
    if ('role' in body) {
      const role = body.role as Member['role']
      const validRoles: Member['role'][] = ['Admin', 'Developer', 'User', 'Auditor']
      if (!validRoles.includes(role)) {
        return Response.json({ error: { code: 'invalid', message: '角色无效' } }, { status: 400 })
      }
      await updateMemberRole(ctx, userId, role)
    }

    if ('status' in body) {
      const status = body.status as 'active' | 'inactive'
      if (status !== 'active' && status !== 'inactive') {
        return Response.json({ error: { code: 'invalid', message: '状态无效' } }, { status: 400 })
      }
      await setMemberStatus(ctx, userId, status)
    }

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '操作失败'
    if (msg.includes('不存在或无权限')) {
      return Response.json({ error: { code: 'not_found', message: msg } }, { status: 404 })
    }
    return Response.json({ error: { code: 'server_error', message: msg } }, { status: 500 })
  }
}
