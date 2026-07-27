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

/** 开通新租户（校验 code 唯一 / email 合法 / 配额>0）。 */
export async function provisionTenant(input: ProvisionInput): Promise<TenantSummary> {
  const name = input.name?.trim()
  const code = input.code?.trim()
  if (!name) throw new Error('企业名称不能为空')
  if (!code || !/^[a-zA-Z0-9_-]{2,32}$/.test(code)) throw new Error('企业编码非法（2-32 位字母数字/下划线/连字符）')
  if (!EMAIL_RE.test(input.contactEmail?.trim() ?? '')) throw new Error('联系邮箱格式非法')
  if (!Number.isFinite(input.tokenQuota) || input.tokenQuota <= 0) throw new Error('Token 配额必须为正数')

  const admin = createAdminClient()
  const { data: dup } = await admin.from('tenants').select('id').eq('code', code).is('deleted_at', null).maybeSingle()
  if (dup) throw new Error('企业编码已存在')

  const { data, error } = await admin
    .from('tenants')
    .insert({
      name, code, contact_name: input.contactName?.trim() || null,
      contact_email: input.contactEmail.trim(),
      token_quota: input.tokenQuota, status: 'active',
    })
    .select(COLS).single()
  if (error) throw new Error(error.message)
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
    throw new Error(`租户已创建但首个管理员开通失败，已回滚：${e instanceof Error ? e.message : '未知错误'}`)
  }
  return tenant
}

type AdminClient = ReturnType<typeof createAdminClient>

/** 为新租户创建首个 Admin：Auth 邀请 + users 预建 + user_roles=Admin。返回 authUserId。 */
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

  const { error: uErr } = await admin
    .from('users')
    .insert({ id: uid, org_id: input.orgId, name: input.name, email: input.email, status: 'active' })
  if (uErr) throw new Error(uErr.message)

  const { error: rErr } = await admin
    .from('user_roles')
    .insert({ user_id: uid, org_id: input.orgId, role: 'Admin' })
  if (rErr) throw new Error(rErr.message)

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
