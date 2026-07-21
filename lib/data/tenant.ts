import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 租户数据层（ADR-008，4.5.2）：本租户信息 + 配额 + 用量。
// RLS：tenants 的 tenant_read 策略只放行 id=current_org_id() → 天然只能读到自己那家。
// 范围：MVP 仅"Admin/Auditor 看本租户"（tenant:read）；跨租户开通/停用/改他人配额属阶段 6（platform_admin）。

export type MyTenant = {
  id: string
  name: string
  code: string
  shortName: string
  industry: string
  planType: string
  status: string
  contactName: string
  contactEmail: string
  createdAt: string
  quota: { tokenQuota: number; storageQuota: number; qpsLimit: number }
  usage: { members: number; agents: number; knowledgeBases: number; tokensUsed: number }
}

type TenantRow = {
  id: string
  name: string
  code: string
  short_name: string | null
  industry: string | null
  plan_type: string
  status: string
  contact_name: string | null
  contact_email: string | null
  token_quota: number | null
  storage_quota: number | null
  qps_limit: number | null
  created_at: string | null
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'users' | 'agents' | 'knowledge_bases',
  orgId: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null)
  return count ?? 0
}

export async function getMyTenant(ctx: RequestContext): Promise<MyTenant | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id,name,code,short_name,industry,plan_type,status,contact_name,contact_email,token_quota,storage_quota,qps_limit,created_at',
    )
    .eq('id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as TenantRow

  const [members, agents, knowledgeBases] = await Promise.all([
    countRows(supabase, 'users', ctx.orgId),
    countRows(supabase, 'agents', ctx.orgId),
    countRows(supabase, 'knowledge_bases', ctx.orgId),
  ])

  // 累计 token 用量（call_logs，RLS 按 org 隔离）；无数据则 0
  let tokensUsed = 0
  const { data: logs } = await supabase
    .from('call_logs')
    .select('tokens_in,tokens_out')
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
  for (const l of (logs as { tokens_in: number | null; tokens_out: number | null }[] | null) ?? []) {
    tokensUsed += (l.tokens_in ?? 0) + (l.tokens_out ?? 0)
  }

  return {
    id: r.id,
    name: r.name,
    code: r.code,
    shortName: r.short_name ?? '',
    industry: r.industry ?? '',
    planType: r.plan_type,
    status: r.status,
    contactName: r.contact_name ?? '',
    contactEmail: r.contact_email ?? '',
    createdAt: (r.created_at ?? '').slice(0, 10),
    quota: {
      tokenQuota: r.token_quota ?? 0,
      storageQuota: r.storage_quota ?? 0,
      qpsLimit: r.qps_limit ?? 0,
    },
    usage: { members, agents, knowledgeBases, tokensUsed },
  }
}
