import 'server-only'
import type { Member } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/data/audit'

// 角色优先级：用于多角色时取"最高权"角色展示
const ROLE_PRIORITY: Member['role'][] = ['Admin', 'Developer', 'Auditor', 'User']

type UserRow = {
  id: string
  name: string
  email: string
  department: string | null
  status: 'active' | 'inactive'
  last_active_at: string | null
  created_at: string
  user_roles: { role: string }[]
}

function mapRow(r: UserRow): Member {
  const roles = r.user_roles.map((ur) => ur.role as Member['role'])
  const primaryRole = ROLE_PRIORITY.find((p) => roles.includes(p)) ?? 'User'
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    department: r.department ?? '',
    role: primaryRole,
    status: r.status === 'inactive' ? 'disabled' : 'active',
    lastLogin: r.last_active_at ? r.last_active_at.slice(0, 10) : r.created_at.slice(0, 10),
  }
}

export async function listMembers(ctx: RequestContext): Promise<Member[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email,department,status,last_active_at,created_at,user_roles(role)')
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as UserRow[] | null ?? []).map(mapRow)
}

export async function updateMemberRole(
  ctx: RequestContext,
  userId: string,
  role: Member['role'],
): Promise<void> {
  const supabase = await createClient()
  // 验证 userId 属于同一 org
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (ue || !user) throw new Error('成员不存在或无权限')

  // 软删旧角色，插入新角色（保留历史记录）
  const { error: delErr } = await supabase
    .from('user_roles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)

  const { error: insErr } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, org_id: ctx.orgId, role })
  if (insErr) throw new Error(insErr.message)

  // 4.8.4：成员授权留痕（ADR-007 §4）。写失败不阻断（业务已落库）。
  await writeAudit(ctx, 'member.role_updated', 'user', userId, { role })
}

/**
 * 4.8.12：更新成员资料（姓名 / 部门）。
 * 部门本期仍是 users.department 文本字段；4.8.14a 建 departments 表后改为外键。
 */
export async function updateMemberProfile(
  ctx: RequestContext,
  userId: string,
  input: { name?: string; department?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.department !== undefined) patch.department = input.department || null
  if (Object.keys(patch).length === 0) return

  const supabase = await createClient()
  // 验证 userId 属于同一 org
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (ue || !user) throw new Error('成员不存在或无权限')

  patch.updated_at = new Date().toISOString()
  const { error: upErr } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
  if (upErr) throw new Error(upErr.message)

  await writeAudit(ctx, 'member.profile_updated', 'user', userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.department !== undefined ? { department: input.department || null } : {}),
  })
}

/**
 * 4.8.12：移除成员（软删 users + 撤销角色 + 封禁登录）。
 * 两条护栏：不能移除自己；不能移除本租户最后一名 Admin（否则组织将无人可管理）。
 */
export async function removeMember(ctx: RequestContext, userId: string): Promise<void> {
  if (userId === ctx.userId) throw new Error('不能移除自己')

  const supabase = await createClient()
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (ue || !user) throw new Error('成员不存在或无权限')

  // 最后一名 Admin 保护：用户软删时其 user_roles 一并软删，故活跃 Admin 角色行即活跃管理员
  const { data: adminRows, error: arErr } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('org_id', ctx.orgId)
    .eq('role', 'Admin')
    .is('deleted_at', null)
  if (arErr) throw new Error(arErr.message)
  const adminIds = new Set((adminRows as { user_id: string }[] | null ?? []).map((r) => r.user_id))
  if (adminIds.has(userId) && adminIds.size <= 1) {
    throw new Error('不能移除最后一名管理员')
  }

  const now = new Date().toISOString()
  const { error: delRoleErr } = await supabase
    .from('user_roles')
    .update({ deleted_at: now })
    .eq('user_id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
  if (delRoleErr) throw new Error(delRoleErr.message)

  const { error: delUserErr } = await supabase
    .from('users')
    .update({ deleted_at: now, status: 'inactive', updated_at: now })
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
  if (delUserErr) throw new Error(delUserErr.message)

  // 封禁登录（service_role，ADR-002 合规用途，与 setMemberStatus 一致）
  const admin = createAdminClient()
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: '876600h',
  })
  if (authErr) throw new Error(authErr.message)

  await writeAudit(ctx, 'member.removed', 'user', userId, {})
}

export async function setMemberStatus(
  ctx: RequestContext,
  userId: string,
  status: 'active' | 'inactive',
): Promise<void> {
  const supabase = await createClient()
  // 验证 userId 属于同一 org
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (ue || !user) throw new Error('成员不存在或无权限')

  // 更新 users 表状态
  const { error: upErr } = await supabase
    .from('users')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
  if (upErr) throw new Error(upErr.message)

  // 同步 Supabase Auth ban 状态（用 service_role，ADR-002 合规用途）
  const admin = createAdminClient()
  const banDuration = status === 'inactive' ? '876600h' : 'none'
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  })
  if (authErr) throw new Error(authErr.message)

  // 4.8.4：成员启停留痕（ADR-007 §4）。
  await writeAudit(ctx, 'member.status_changed', 'user', userId, { status })
}

export async function inviteMember(
  ctx: RequestContext,
  input: { email: string; name: string; role: Member['role']; department?: string },
): Promise<Member> {
  const admin = createAdminClient()

  // 0. 幂等：本租户内邮箱已存在则拒绝（返回中文提示，供前端展示）
  const reqClient = await createClient()
  const { data: dup } = await reqClient
    .from('users')
    .select('id')
    .eq('email', input.email)
    .is('deleted_at', null)
    .maybeSingle()
  if (dup) throw new Error('该邮箱已邀请或已是成员')

  // 1. 通过 Supabase Auth 发邀请邮件（创建 auth.users）
  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { org_id: ctx.orgId, name: input.name } },
  )
  if (invErr) throw new Error(invErr.message)
  const authUserId = invited.user.id

  // 2. 在 users 表预建记录
  const supabase = await createClient()
  const { data: newUser, error: userErr } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      org_id: ctx.orgId,
      name: input.name,
      email: input.email,
      department: input.department ?? null,
      status: 'active',
    })
    .select('id,name,email,department,status,last_active_at,created_at')
    .single()
  if (userErr) throw new Error(userErr.message)

  // 3. 分配角色
  const { error: roleErr } = await supabase
    .from('user_roles')
    .insert({ user_id: authUserId, org_id: ctx.orgId, role: input.role })
  if (roleErr) throw new Error(roleErr.message)

  return {
    id: authUserId,
    name: input.name,
    email: input.email,
    department: input.department ?? '',
    role: input.role,
    status: 'active',
    lastLogin: (newUser as { created_at: string }).created_at.slice(0, 10),
  }
}
