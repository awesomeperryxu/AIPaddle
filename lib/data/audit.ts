import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 审计留痕（4.1.3）。audit_logs 不可篡改（无 deleted_at/updated_at），只追加。
// 写失败不应阻断主流程（业务已落库），因此吞掉错误只记 console。
export async function writeAudit(
  ctx: RequestContext,
  action: string, // 如 agent.submit / agent.approve / agent.reject
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('audit_logs').insert({
      org_id: ctx.orgId,
      actor_id: ctx.userId,
      action,
      target_type: targetType,
      target_id: targetId,
      detail,
    })
    if (error) console.error('[audit] 写入失败:', action, error.message)
  } catch (e) {
    console.error('[audit] 写入异常:', action, e)
  }
}

// 审计日志读取（4.1.3）。视图/规格化后的一条审计记录。
export type AuditLog = {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  detail: Record<string, unknown>
  actorId: string | null
  actorName: string | null
  ip: string | null
  createdAt: string | null
}

type AuditRow = {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  detail: Record<string, unknown> | null
  actor_id: string | null
  ip: string | null
  created_at: string | null
  actor: { name: string | null } | null
}

// 列出本租户审计日志（RLS 兜底租户隔离，created_at 降序，默认 100 条）。
// 只读追加表，join users 拿操作人名。
export async function listAudit(
  _ctx: RequestContext,
  opts: { limit?: number; since?: string; action?: string } = {},
): Promise<AuditLog[]> {
  const supabase = await createClient()
  let query = supabase
    .from('audit_logs')
    .select('id,action,target_type,target_id,detail,ip,created_at,actor_id,actor:users!actor_id(name)')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.since) query = query.gte('created_at', opts.since)
  if (opts.action) query = query.eq('action', opts.action)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as AuditRow[]
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    detail: r.detail ?? {},
    actorId: r.actor_id,
    actorName: r.actor?.name ?? null,
    ip: r.ip,
    createdAt: r.created_at,
  }))
}
