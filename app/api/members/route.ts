import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listMembers, inviteMember } from '@/lib/data/members'
import { checkPassword } from '@/lib/auth/password'
import type { Member } from '@/lib/mock-data'

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const members = await listMembers(ctx)
  return Response.json({ members })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'member:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理成员' } }, { status: 403 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const email = String(body?.email ?? '').trim()
  const name = String(body?.name ?? '').trim()
  const role = body?.role as Member['role'] | undefined
  const department = typeof body?.department === 'string' ? body.department.trim() : undefined

  if (!email || !name) {
    return Response.json({ error: { code: 'invalid', message: '邮箱和姓名不能为空' } }, { status: 400 })
  }
  const validRoles: Member['role'][] = ['Admin', 'Developer', 'User', 'Auditor']
  if (!role || !validRoles.includes(role)) {
    return Response.json({ error: { code: 'invalid', message: '角色无效' } }, { status: 400 })
  }
  // 4.8.18：创建人指定初始密码（不再发邀请邮件）。密码只往下透传给 Auth，
  // 不落业务库、不进审计、不回前端。
  const password = typeof body?.password === 'string' ? body.password : ''
  const pwdErr = checkPassword(password)
  if (pwdErr) return Response.json({ error: { code: 'invalid', message: pwdErr } }, { status: 400 })

  try {
    const member = await inviteMember(ctx, { email, name, role, department, password })
    return Response.json({ member }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建成员失败'
    const status = /已.*成员|已被占用|已有账号/.test(msg) ? 409 : 500
    return Response.json({ error: { code: status === 409 ? 'conflict' : 'server_error', message: msg } }, { status })
  }
}
