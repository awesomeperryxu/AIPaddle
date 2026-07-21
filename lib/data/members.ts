import 'server-only'
import type { Member } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
