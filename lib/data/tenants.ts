import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// 平台级租户数据层（ADR-010）：跨租户操作，用 service_role（ADR-002 唯一沙可）。
// ⚠️ 每个导出函数都必须由 API 入口的 isPlatformAdmin 兜住；此层不做 RLS 隔离。
// 与 lib/data/tenant.ts（单数，「本租户设置」，请求级 RLS）互不干扰。

export type TenantStatus = 'active' | 'suspended'
export type PlanType = 'free' | 'standard' | 'pro' | 'enterprise'

export type TenantSummary = {
  id: string
  name: string
  code: string
  planType: PlanType
  tokenQuota: number
  qpsLimit: number
  status: TenantStatus
  contactName: string
  contactEmail: string
  createdAt: string
}

type Row = {
  id: string; name: string; code: string; plan_type: string
  token_quota: number | null; qps_limit: number | null; status: string
  contact_name: string | null; contact_email: string | null; created_at: string | null
}

const COLS = 'id,name,code,plan_type,token_quota,qps_limit,status,contact_name,contact_email,created_at'

function map(r: Row): TenantSummary {
  return {
    id: r.id, name: r.name, code: r.code,
    planType: (r.plan_type as PlanType) ?? 'free',
    tokenQuota: r.token_quota ?? 0, qpsLimit: r.qps_limit ?? 0,
    status: (r.status as TenantStatus) ?? 'active',
    contactName: r.contact_name ?? '', contactEmail: r.contact_email ?? '',
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

/** 列出全部租户（平台视角）。 */
export async function listAllTenants(): Promise<TenantSummary[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants').select(COLS).is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(map)
}

// ADR-017：取消套餐分级——provision 不再收 planType；plan_type 走列默认值（'free'），仅作废弃保留列。
export type ProvisionInput = {
  name: string; code: string; contactName: string; contactEmail: string
  tokenQuota: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * BUG-83：把 tenants 插入的唯一约束冲突转成人话。
 * `tenants_code_key` 是 0001 的全表唯一约束（不认软删），`uq_tenants_code_active` 是
 * 迁移 0024 对齐后的部分唯一索引；两者都可能命中，故一并识别。
 */
function friendlyTenantInsertError(message: string, code?: string): string {
  const text = `${code ?? ''} ${message}`
  if (text.includes('tenants_code_key')) {
    return '该企业编码已被占用（可能属于一个已注销的租户，编码仍被旧约束保留），请更换编码'
  }
  if (text.includes('uq_tenants_code_active')) return '该企业编码已存在，请更换编码'
  return message
}

/** 开通新租户（校验 code 唯一 / email 合法 / 配额>0）。 */
// adminOverride 仅供测试注入假客户端（与 createFirstAdmin 接受 admin 参数的既有风格一致）；
// 生产路径始终走 createAdminClient()。
export async function provisionTenant(
  input: ProvisionInput,
  adminOverride?: AdminClient,
): Promise<TenantSummary> {
  const name = input.name?.trim()
  const code = input.code?.trim()
  if (!name) throw new Error('企业名称不能为空')
  if (!code || !/^[a-zA-Z0-9_-]{2,32}$/.test(code)) throw new Error('企业编码非法（2-32 位字母数字/下划线/连字符）')
  if (!EMAIL_RE.test(input.contactEmail?.trim() ?? '')) throw new Error('联系邮箱格式非法')
  if (!Number.isFinite(input.tokenQuota) || input.tokenQuota <= 0) throw new Error('Token 配额必须为正数')

  const admin = adminOverride ?? createAdminClient()
  const { data: dup } = await admin.from('tenants').select('id').eq('code', code).is('deleted_at', null).maybeSingle()
  if (dup) throw new Error('企业编码已存在')

  // BUG-81 前置校验：一个邮箱只能属于一个租户（public.users.id 主键引用 auth.users + email 全局唯一）。
  // 必须在建租户「之前」拦下，否则会走到「建完再撞库回滚」，把 Postgres 原文报错甩给用户。
  await assertEmailAvailable(admin, input.contactEmail.trim())

  const { data, error } = await admin
    .from('tenants')
    .insert({
      name, code, contact_name: input.contactName?.trim() || null,
      contact_email: input.contactEmail.trim(),
      token_quota: input.tokenQuota, status: 'active',
    })
    .select(COLS).single()
  // BUG-83 兜底：迁移 0024 之前，DB 的 code 唯一约束是全表的（不认软删），与上面的查重语义
  // 不一致；且即使对齐后仍可能有并发抢同一编码。这里把唯一冲突转人话，不再甩 Postgres 原文。
  if (error) throw new Error(friendlyTenantInsertError(error.message, error.code))
  const tenant = map(data as Row)

  // 4.8.3 开户闭环：开通即建首个 Admin（联系邮箱），发 Auth 邀请邮件让其设密登录。
  // 平台级跨租户写，全程 service_role（新租户尚无成员，无法用请求级客户端）。
  // 失败则回滚（软删刚建的租户），不残留「无管理员」的租户。
  try {
    await createFirstAdmin(admin, {
      orgId: tenant.id,
      name: input.contactName?.trim() || input.contactEmail.trim(),
      email: input.contactEmail.trim(),
    })
  } catch (e) {
    await admin.from('tenants').update({ deleted_at: new Date().toISOString() }).eq('id', tenant.id)
    throw new Error(`企业开通失败，已回滚：${e instanceof Error ? e.message : '未知错误'}`)
  }
  return tenant
}

type AdminClient = ReturnType<typeof createAdminClient>

// 新建 auth 账号与「复用已存在账号」的判定窗口：invite 对已注册但未确认的邮箱会静默返回原账号，
// 那种账号不属于本次开通，回滚时绝不能删（会误删他人账号）。
const FRESH_USER_WINDOW_MS = 60_000

/**
 * BUG-81：联系邮箱占用前置校验。
 * 数据模型上一个邮箱只能属于一个租户，这里把冲突转成人话，并指出被谁占用。
 */
export async function assertEmailAvailable(admin: AdminClient, email: string): Promise<void> {
  const { data: occupied, error } = await admin
    .from('users')
    .select('id,org_id,deleted_at')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!occupied) return

  const row = occupied as { id: string; org_id: string; deleted_at: string | null }

  // BUG-86：已被移除（软删）的成员**不再算永久占用**——createFirstAdmin 会复活那一行。
  // 只有仍在册的成员才拒绝：一个邮箱同时只能属于一个租户。
  if (row.deleted_at) return

  const { data: org } = await admin.from('tenants').select('name').eq('id', row.org_id).maybeSingle()
  const orgName = (org as { name: string } | null)?.name ?? '其他企业'
  throw new Error(`该邮箱已是「${orgName}」的成员，请更换联系邮箱`)
}

// 把 Postgres 唯一约束原文转成用户能看懂的中文
function friendlyUserInsertError(message: string, code?: string): string {
  const text = `${code ?? ''} ${message}`
  if (text.includes('users_pkey')) return '该邮箱在系统中已有账号且归属其他企业，请更换联系邮箱'
  if (text.includes('users_email_key') || text.includes('email')) return '该邮箱已被占用，请更换联系邮箱'
  return message
}

/**
 * 为新租户创建首个 Admin：Auth 邀请 + users 预建 + user_roles=Admin。返回 authUserId。
 * BUG-81：任一步失败都要把本次已建的痕迹清干净，否则残骸会让同邮箱重试永久失败。
 */
export async function createFirstAdmin(
  admin: AdminClient,
  input: { orgId: string; name: string; email: string },
): Promise<string> {
  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { data: { org_id: input.orgId, name: input.name } },
  )
  if (invErr) throw new Error(invErr.message)
  const uid = invited.user.id
  const createdAt = invited.user.created_at ? new Date(invited.user.created_at).getTime() : 0
  const isFreshAuthUser = Date.now() - createdAt < FRESH_USER_WINDOW_MS

  // BUG-86：该邮箱可能留有一行**已软删**的成员（曾被移除）。users.id 是主键且 = auth uid，
  // 而 invite 对已注册邮箱会复用同一 uid，此时 INSERT 必撞 users_pkey——改为复活那一行。
  const { data: soft } = await admin
    .from('users').select('id,org_id').eq('email', input.email).not('deleted_at', 'is', null).maybeSingle()
  const revived = soft as { id: string; org_id: string } | null

  try {
    const { error: uErr } = revived
      ? await admin
          .from('users')
          .update({
            org_id: input.orgId, name: input.name, status: 'active',
            deleted_at: null, updated_at: new Date().toISOString(),
          })
          .eq('id', revived.id)
      : await admin
          .from('users')
          .insert({ id: uid, org_id: input.orgId, name: input.name, email: input.email, status: 'active' })
    if (uErr) throw new Error(friendlyUserInsertError(uErr.message, uErr.code))

    // 复活的账号在移除时被封了 100 年，不解封则设完密码也登不进来
    if (revived) {
      const { error: unbanErr } = await admin.auth.admin.updateUserById(uid, { ban_duration: 'none' })
      if (unbanErr) throw new Error(unbanErr.message)
      await admin.from('audit_logs').insert({
        org_id: input.orgId, actor_id: uid,
        action: revived.org_id === input.orgId ? 'member.revived' : 'member.transferred',
        target_type: 'user', target_id: uid,
        detail: { email: input.email, from_org_id: revived.org_id, to_org_id: input.orgId, via: 'provisionTenant' },
      })
    }

    const { error: rErr } = await admin
      .from('user_roles')
      .insert({ user_id: uid, org_id: input.orgId, role: 'Admin' })
    if (rErr) throw new Error(rErr.message)
  } catch (e) {
    await admin.from('user_roles').delete().eq('user_id', uid).eq('org_id', input.orgId)
    if (revived) {
      // 🔴 复活路径失败：绝不能 DELETE——那是别的租户的历史成员行。改为还原成软删态并放回原租户
      await admin.from('users').update({
        org_id: revived.org_id, status: 'inactive',
        deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', revived.id)
      await admin.auth.admin.updateUserById(uid, { ban_duration: '876600h' }) // 恢复封禁
    } else {
      // 新建路径：只删本租户下的痕迹；auth 账号仅在确认是本次新建时才删
      await admin.from('users').delete().eq('id', uid).eq('org_id', input.orgId)
      if (isFreshAuthUser) await admin.auth.admin.deleteUser(uid)
    }
    throw e
  }

  return uid
}

/** 停用 / 启用租户。 */
export async function setTenantStatus(id: string, status: TenantStatus): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).is('deleted_at', null)
  if (error) throw new Error(error.message)
}

/** 注销租户（软删，置 deleted_at）。4.8.9：替代前端死按钮。返回是否命中在册租户。 */
export async function deleteTenant(id: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenants')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).is('deleted_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  return ((data as { id: string }[] | null) ?? []).length > 0
}
