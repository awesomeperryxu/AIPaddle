import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// DE-8：查「谁把这个 Agent 当下级用」——下线/删除前必须知道会连累谁。
//
// 🔴 现状是零校验：2026-08-07 实测线上有 **65 行** agent_resources 指向已被删除的
// Agent，波及 19 个数字员工里的 16 个（全部 published）。根因就是删/下线 Agent 时
// 从不看有没有上级在引用它，agent_resources 也不跟着软删。
//
// 形状照搬 Tool 下线的 409 + 受影响清单（app/api/tools/[id]/transition），
// 那套已经在 Plugin 页跑通：第一次请求回 409 带清单，用户确认后带 confirm 再来。

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Dependent = {
  id: string
  name: string
  status: 'draft' | 'pending' | 'published' | 'offline'
}

/**
 * 列出把 agentId 当下级引用的上级 Agent（数字员工）。
 * 只返回**未删除**的上级；是否只看 published 由调用方决定——
 * 下线联动关心的是已发布的上级，删除时则应看全部。
 */
export async function listDependentDigitalEmployees(
  _ctx: RequestContext,
  agentId: string,
): Promise<Dependent[]> {
  if (!UUID_RE.test(agentId)) return []
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('agent_resources')
    .select('agent_id')
    .eq('resource_type', 'agent')
    .eq('resource_id', agentId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  const parentIds = [...new Set(((rows as { agent_id: string }[] | null) ?? []).map((r) => r.agent_id))]
  if (parentIds.length === 0) return []

  const { data: parents, error: pErr } = await supabase
    .from('agents')
    .select('id,name,status')
    .in('id', parentIds)
    .is('deleted_at', null)
  if (pErr) throw new Error(pErr.message)

  return ((parents as Record<string, unknown>[] | null) ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    status: p.status as Dependent['status'],
  }))
}

/**
 * 把一批上级数字员工置为下线（下级被下线时的联动，AC-08c）。
 *
 * 🔴 只下线、**不记录"是联动下线"**。因为恢复策略是「解除封锁而非自动拉起」
 * （ADR-026 §5）：下级恢复后由人重新点发布，不需要区分下线原因。
 * 若哪天改成自动拉起，才需要引入这个状态维度——而那会覆盖人为下线的决定。
 */
export async function offlineDigitalEmployees(
  _ctx: RequestContext,
  ids: string[],
): Promise<number> {
  const valid = ids.filter((x) => UUID_RE.test(x))
  if (valid.length === 0) return 0
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agents')
    .update({ status: 'offline', updated_at: new Date().toISOString() })
    .in('id', valid)
    .eq('status', 'published')   // 只动已发布的，别把草稿/待审核也改掉
    .is('deleted_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  return ((data as unknown[] | null) ?? []).length
}
