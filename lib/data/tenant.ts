import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

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
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
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
