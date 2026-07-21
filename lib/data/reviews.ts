import 'server-only'
import type { SecurityReview } from '@/lib/mock-data'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 审批记录数据层（4.1.3）。security_reviews：提交审核建 pending 记录、审核裁决更新，安全模块可查。
// 租户隔离由 RLS 兜底（首参 ctx，请求级客户端）。

export type ReviewType = 'agent' | 'skill' | 'workflow'

// 提交审核 → 建一条 pending 审批记录（Agent submit / Skill 申请上架：draft→pending）。
export async function recordSubmission(
  ctx: RequestContext,
  resourceId: string,
  riskLevel: 'low' | 'medium' | 'high' = 'medium',
  type: ReviewType = 'agent',
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('security_reviews').insert({
    org_id: ctx.orgId,
    type,
    resource_id: resourceId,
    submitter_id: ctx.userId,
    risk_level: riskLevel,
    status: 'pending',
  })
  if (error) throw new Error(error.message)
}

// 审核裁决 → 把该资源最近的 pending 记录更新为 approved/rejected（approve/reject）。
export async function recordReviewDecision(
  ctx: RequestContext,
  resourceId: string,
  decision: 'approved' | 'rejected',
  comments?: string,
  type: ReviewType = 'agent',
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('security_reviews')
    .update({
      status: decision,
      reviewer_id: ctx.userId,
      reviewed_at: new Date().toISOString(),
      ...(comments ? { comments } : {}),
    })
    .eq('type', type)
    .eq('resource_id', resourceId)
    .eq('status', 'pending')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

type ReviewRow = {
  id: string
  type: string
  resource_id: string
  risk_level: 'low' | 'medium' | 'high'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string | null
  submitter: { name: string | null } | null
}

// 审批记录可查：列出本租户审批记录，映射为视图用的 SecurityReview 形状。
export async function listReviews(_ctx: RequestContext): Promise<SecurityReview[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('security_reviews')
    .select('id,type,resource_id,risk_level,status,created_at,submitter:users!submitter_id(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ReviewRow[]

  // 解析资源名（按类型批量查对应表：agent→agents，skill→skills）
  const nameById = new Map<string, string>()
  const agentIds = rows.filter(r => r.type === 'agent').map(r => r.resource_id)
  if (agentIds.length > 0) {
    const { data: agents } = await supabase.from('agents').select('id,name').in('id', agentIds)
    for (const a of (agents ?? []) as { id: string; name: string }[]) nameById.set(a.id, a.name)
  }
  const skillIds = rows.filter(r => r.type === 'skill').map(r => r.resource_id)
  if (skillIds.length > 0) {
    const { data: skills } = await supabase.from('skills').select('id,name').in('id', skillIds)
    for (const s of (skills ?? []) as { id: string; name: string }[]) nameById.set(s.id, s.name)
  }

  return rows.map(r => ({
    id: r.id,
    resourceType: r.type === 'skill' ? 'skill' : r.type === 'workflow' ? 'workflow' : 'agent',
    resourceName: nameById.get(r.resource_id) ?? r.resource_id.slice(0, 8),
    submitter: r.submitter?.name ?? '—',
    riskLevel: r.risk_level,
    sensitiveDataFound: [],
    illegalInstructions: [],
    dbRisks: [],
    status: r.status,
    submittedAt: (r.created_at ?? '').slice(0, 10),
  }))
}
