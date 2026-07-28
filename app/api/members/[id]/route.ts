import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  updateMemberRole,
  setMemberStatus,
  updateMemberProfile,
  removeMember,
  resetMemberPassword,
} from '@/lib/data/members'
import { checkPassword } from '@/lib/auth/password'
import type { Member } from '@/lib/mock-data'

const NAME_MAX = 50
const DEPT_MAX = 50

// 业务护栏拒绝（移除自己 / 最后一名管理员 / 重置自己密码）映射为 409
function fail(msg: string) {
  const status = msg.includes('不存在或无权限') ? 404
    : /不能移除|不能重置自己/.test(msg) ? 409 : 500
  const code = status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'server_error'
  return Response.json({ error: { code, message: msg } }, { status })
}

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

    // 4.8.19：管理员重置成员密码（不需原密码，故严格限本租户在册成员且不能是自己）
    if ('password' in body) {
      const pwdErr = checkPassword(body.password)
      if (pwdErr) return Response.json({ error: { code: 'invalid', message: pwdErr } }, { status: 400 })
      await resetMemberPassword(ctx, userId, body.password as string)
    }

    // 4.8.12：资料编辑（姓名 / 部门）
    if ('name' in body || 'department' in body) {
      const profile: { name?: string; department?: string } = {}

      if ('name' in body) {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name) {
          return Response.json({ error: { code: 'invalid', message: '姓名不能为空' } }, { status: 400 })
        }
        if (name.length > NAME_MAX) {
          return Response.json({ error: { code: 'invalid', message: `姓名不能超过 ${NAME_MAX} 字` } }, { status: 400 })
        }
        profile.name = name
      }

      if ('department' in body) {
        if (body.department !== null && typeof body.department !== 'string') {
          return Response.json({ error: { code: 'invalid', message: '部门无效' } }, { status: 400 })
        }
        const department = ((body.department as string | null) ?? '').trim()
        if (department.length > DEPT_MAX) {
          return Response.json({ error: { code: 'invalid', message: `部门不能超过 ${DEPT_MAX} 字` } }, { status: 400 })
        }
        profile.department = department
      }

      await updateMemberProfile(ctx, userId, profile)
    }

    return Response.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '操作失败')
  }
}

// 4.8.12：移除成员（软删 + 撤角色 + 封禁登录）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'member:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理成员' } }, { status: 403 })

  const { id: userId } = await params
  try {
    await removeMember(ctx, userId)
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '操作失败')
  }
}
