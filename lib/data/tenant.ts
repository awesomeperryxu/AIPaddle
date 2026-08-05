import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { AGENT_MODELS } from '@/lib/agents/config'

export type TenantInfo = {
  id: string
  name: string
  shortName: string | null
  industry: string | null
  companySize: string | null
  planType: 'free' | 'standard' | 'pro' | 'enterprise'
  status: 'active' | 'suspended'
  contactName: string | null
  contactEmail: string | null
  tokenQuota: number
  storageQuota: number
  qpsLimit: number
  createdAt: string
  // 用量统计（实时 COUNT）
  usage: {
    members: number
    agents: number
    knowledgeBases: number
  }
}

export type TenantUpdateInput = {
  name?: string
  shortName?: string
  industry?: string
  companySize?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

/**
 * Key-1：只取当前租户名（单行单列）。
 * 页头标注归属用，不值得为一个名字跑 getTenant 里的三次 COUNT。
 */
export async function getTenantName(ctx: RequestContext): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenants').select('name').eq('id', ctx.orgId).maybeSingle()
  return (data as { name: string } | null)?.name ?? null
}

export async function getTenant(ctx: RequestContext): Promise<TenantInfo> {
  const supabase = await createClient()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id,name,short_name,industry,company_size,plan_type,status,contact_name,contact_email,token_quota,storage_quota,qps_limit,created_at')
    .eq('id', ctx.orgId)
    .single()

  if (error || !tenant) throw new Error(error?.message ?? 'tenant not found')

  // 并行拉三张表的 COUNT
  const [{ count: members }, { count: agents }, { count: kbs }] = await Promise.all([
    // 排除机器用户，口径与租户管理页一致（ADR-020 §3）
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('is_service_account', false),
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).is('deleted_at', null),
    supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).is('deleted_at', null),
  ])

  return {
    id: tenant.id,
    name: tenant.name,
    shortName: tenant.short_name,
    industry: tenant.industry,
    companySize: tenant.company_size,
    planType: tenant.plan_type as TenantInfo['planType'],
    status: tenant.status as TenantInfo['status'],
    contactName: tenant.contact_name,
    contactEmail: tenant.contact_email,
    tokenQuota: tenant.token_quota,
    storageQuota: tenant.storage_quota,
    qpsLimit: tenant.qps_limit,
    createdAt: tenant.created_at.slice(0, 10),
    usage: {
      members: members ?? 0,
      agents: agents ?? 0,
      knowledgeBases: kbs ?? 0,
    },
  }
}

export async function updateTenant(
  ctx: RequestContext,
  input: TenantUpdateInput,
): Promise<void> {
  const supabase = await createClient()

  const patch: Record<string, string | undefined> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.shortName !== undefined) patch.short_name = input.shortName
  if (input.industry !== undefined) patch.industry = input.industry
  if (input.companySize !== undefined) patch.company_size = input.companySize
  if (input.contactName !== undefined) patch.contact_name = input.contactName
  if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail
  if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase
    .from('tenants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', ctx.orgId)

  if (error) throw new Error(error.message)
}

/** 读当前租户的默认 LLM 模型（RLS 只允许读本租户那行）。 */
/**
 * @deprecated 4.8.11：默认模型单一事实源改为 `model_settings`（5 槽，见 lib/data/model-providers）。
 * 运行时由 `resolveModelClient(ctx)` 消费 model_settings，不再读 `default_model`。
 * 本函数仅历史兼容保留（侧栏轻量选择器），勿新增运行时依赖。
 */
export async function getTenantDefaultModel(ctx: RequestContext): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('default_model')
    .eq('id', ctx.orgId)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'tenant not found')
  return (data.default_model as string) ?? 'qwen-plus'
}

/** 设置当前租户的默认 LLM 模型；model 必须 ∈ AGENT_MODELS.value（服务端兜底校验）。 */
export async function setTenantDefaultModel(ctx: RequestContext, model: string): Promise<void> {
  if (!AGENT_MODELS.some((m) => m.value === model)) {
    throw new Error(`非法模型：${model}`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update({ default_model: model, updated_at: new Date().toISOString() })
    .eq('id', ctx.orgId)

  if (error) throw new Error(error.message)
}
