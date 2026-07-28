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
 * 4.8.19：管理员为本租户成员重置密码。
 *
 * 与 4.8.18c 的「自行改密」分工：本人改密需验原密码；管理员重置**不需要**原密码
 * （本来就是给忘记密码的人用的），因此必须严格限定：
 *   · 只能重置**本租户在册成员**（跨租户/已移除一律拒绝）；
 *   · **不能重置自己**——自己改密走 /api/auth/password 验原密码那条路，
 *     否则会话被盗者可绕开原密码校验直接改掉自己的密码。
 * 密码只透传给 Auth，不落业务库、不进审计 detail。
 */
export async function resetMemberPassword(
  ctx: RequestContext,
  userId: string,
  newPassword: string,
): Promise<void> {
  if (userId === ctx.userId) {
    throw new Error('不能重置自己的密码，请在「设置 → 修改密码」中操作')
  }

  const supabase = await createClient()
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (ue || !user) throw new Error('成员不存在或无权限')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) throw new Error(error.message)

  // 审计只记「谁给谁重置了密码」，绝不记密码本身
  await writeAudit(ctx, 'member.password_reset', 'user', userId, {})
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

/**
 * 新建成员（4.8.18 起由**创建人直接指定密码**，不再走 Supabase 邀请邮件）。
 * 密码只透传给 Supabase Auth，绝不落业务库、不进审计 detail、不回前端。
 */
export async function inviteMember(
  ctx: RequestContext,
  input: { email: string; name: string; role: Member['role']; department?: string; password: string },
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

  // 0b. BUG-86：该邮箱可能存在一行**已软删**的成员记录（曾被移除，可能属本租户或他租户）。
  // users.id 是主键且引用 auth.users(id)，而 invite 对已注册邮箱会复用同一 auth uid，
  // 所以此时若走 INSERT 必撞 users_pkey/users_email_key——改为**复活那一行**（UPDATE），
  // id 与 auth 账号天然一致，零冲突，也不违反全表软删铁律（C6）。
  const softDeleted = await findSoftDeletedByEmail(admin, input.email)

  // 1. 直接创建 auth 账号并设密码（email_confirm=true 跳过邮箱验证，创建即可登录）。
  // 该邮箱若已有 auth 账号（如曾被移除、或他租户遗留），createUser 会报错——
  // 此时复用既有 auth uid 并重置密码，与下面的「复活软删行」配套。
  let authUserId: string
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { org_id: ctx.orgId, name: input.name },
  })
  if (createErr) {
    const existing = await findAuthUserByEmail(admin, input.email)
    if (!existing) throw new Error(friendlyMemberInsertError(createErr.message, undefined))
    authUserId = existing
    // 复用既有 auth 账号：重置为本次指定的密码并解除可能的封禁
    const { error: resetErr } = await admin.auth.admin.updateUserById(existing, {
      password: input.password,
      ban_duration: 'none',
      user_metadata: { org_id: ctx.orgId, name: input.name },
    })
    if (resetErr) throw new Error(resetErr.message)
  } else {
    authUserId = created.user.id
  }

  const supabase = await createClient()

  if (softDeleted) {
    // 2a. 复活：清软删标记 + 归属到当前租户 + 恢复启用；用 admin 客户端，因为该行
    // 当前可能挂在别的 org 下，请求级客户端受 RLS 限制读不到、也改不动。
    await reviveSoftDeletedMember(admin, {
      userId: softDeleted.id,
      orgId: ctx.orgId,
      name: input.name,
      email: input.email,
      department: input.department ?? null,
      fromOrgId: softDeleted.org_id,
      actorId: ctx.userId,
    })
  } else {
    // 2b. 全新成员：正常预建
    const { error: userErr } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        org_id: ctx.orgId,
        name: input.name,
        email: input.email,
        department: input.department ?? null,
        status: 'active',
      })
      .select('id')
      .single()
    if (userErr) throw new Error(friendlyMemberInsertError(userErr.message, userErr.code))
  }

  // 3. 分配角色。迁移 0025 后 user_roles 的唯一索引只约束在册行，
  // 曾被撤销（软删）的同名角色不再挡路；仍用 upsert 语义兜住并发重复。
  const { error: roleErr } = await supabase
    .from('user_roles')
    .insert({ user_id: authUserId, org_id: ctx.orgId, role: input.role })
  if (roleErr) throw new Error(friendlyMemberInsertError(roleErr.message, roleErr.code))

  return {
    id: authUserId,
    name: input.name,
    email: input.email,
    department: input.department ?? '',
    role: input.role,
    status: 'active',
    lastLogin: new Date().toISOString().slice(0, 10),
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * 4.8.18：按邮箱找既有 auth 账号 id。
 * Supabase admin API 没有「按邮箱查」的直接接口，只能分页扫 listUsers；
 * 仅在 createUser 报冲突时才走这条慢路径，正常新建不受影响。
 */
export async function findAuthUserByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 200) break
  }
  return null
}

/** BUG-86：按邮箱找一行已软删的成员（跨租户，用 admin 客户端绕开 RLS）。 */
export async function findSoftDeletedByEmail(
  admin: AdminClient,
  email: string,
): Promise<{ id: string; org_id: string } | null> {
  const { data, error } = await admin
    .from('users')
    .select('id,org_id,deleted_at')
    .eq('email', email)
    .not('deleted_at', 'is', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { id: (data as { id: string }).id, org_id: (data as { org_id: string }).org_id } : null
}

/**
 * BUG-86：复活一行已软删的成员到目标租户。
 * 跨租户复活会改变该 uid 的归属，故强制写审计（`member.revived`，含来源租户）以保留溯源。
 * 同时解除 Auth 封禁——移除成员时封了 100 年，不解则复活后仍登录不了。
 */
export async function reviveSoftDeletedMember(
  admin: AdminClient,
  p: {
    userId: string; orgId: string; name: string; email: string
    department: string | null; fromOrgId: string; actorId: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from('users')
    .update({
      org_id: p.orgId, name: p.name, department: p.department,
      status: 'active', deleted_at: null, updated_at: now,
    })
    .eq('id', p.userId)
  if (error) throw new Error(friendlyMemberInsertError(error.message, error.code))

  // 解除移除成员时施加的封禁
  const { error: authErr } = await admin.auth.admin.updateUserById(p.userId, { ban_duration: 'none' })
  if (authErr) throw new Error(authErr.message)

  // 跨租户转移必须留痕：service_role 绕过了 RLS，审计是唯一溯源
  await admin.from('audit_logs').insert({
    org_id: p.orgId,
    actor_id: p.actorId,
    action: p.fromOrgId === p.orgId ? 'member.revived' : 'member.transferred',
    target_type: 'user',
    target_id: p.userId,
    detail: { email: p.email, from_org_id: p.fromOrgId, to_org_id: p.orgId },
  })
}

/** 把成员相关的唯一约束冲突转成人话，不再把 Postgres 原文甩给用户。 */
export function friendlyMemberInsertError(message: string, code?: string): string {
  const text = `${code ?? ''} ${message}`
  if (text.includes('users_pkey')) return '该邮箱在系统中已有账号，请联系平台管理员处理'
  if (text.includes('users_email_key')) return '该邮箱已被占用，请更换邮箱'
  if (text.includes('user_roles_user_id_role_key') || text.includes('uq_user_roles_active')) {
    return '该成员已拥有此角色'
  }
  return message
}
