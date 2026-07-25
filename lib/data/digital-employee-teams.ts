import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 数据层（ADR-008 / 4.1.19 / ADR-014）：唯一访问 digital_employee_teams / team_members 的地方。
// 首参 ctx，用请求级客户端（RLS 生效），按租户隔离。成员门控在 API 层（不信前端）。
export type TeamStatus = 'draft' | 'pending' | 'published' | 'offline'

export type Team = {
  id: string
  name: string
  description: string
  status: TeamStatus
  memberIds: string[]
  updatedAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id,name,description,status,updated_at'

type Row = {
  id: string
  name: string
  description: string | null
  status: TeamStatus
  updated_at: string | null
}

function mapRow(r: Row, memberIds: string[]): Team {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    status: r.status,
    memberIds,
    updatedAt: (r.updated_at ?? '').slice(0, 10),
  }
}

/** 列出本租户数字员工团队（不含成员明细，列表用）。RLS 隔离。 */
export async function listTeams(_ctx: RequestContext): Promise<Team[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_employee_teams')
    .select(COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  const teams = (data as Row[] | null) ?? []
  if (teams.length === 0) return []
  // 批量取各团队成员（按 ord 升序）
  const { data: mem, error: mErr } = await supabase
    .from('team_members')
    .select('team_id,agent_id,ord')
    .in('team_id', teams.map((t) => t.id))
    .order('ord', { ascending: true })
  if (mErr) throw new Error(mErr.message)
  const byTeam = new Map<string, string[]>()
  for (const m of (mem as { team_id: string; agent_id: string }[] | null) ?? []) {
    const arr = byTeam.get(m.team_id) ?? []
    arr.push(m.agent_id)
    byTeam.set(m.team_id, arr)
  }
  return teams.map((r) => mapRow(r, byTeam.get(r.id) ?? []))
}

/** 取单个团队（含 memberIds，按 ord 升序）。RLS 兜底：他租户/不存在 → null。 */
export async function getTeam(_ctx: RequestContext, id: string): Promise<Team | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_employee_teams')
    .select(COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: mem, error: mErr } = await supabase
    .from('team_members')
    .select('agent_id,ord')
    .eq('team_id', id)
    .order('ord', { ascending: true })
  if (mErr) throw new Error(mErr.message)
  const memberIds = ((mem as { agent_id: string }[] | null) ?? []).map((m) => m.agent_id)
  return mapRow(data as Row, memberIds)
}

/** 创建团队（草稿态，无成员）。RLS 兜底租户隔离（org_id=ctx.orgId）。 */
export async function createTeam(ctx: RequestContext, input: { name: string }): Promise<Team> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_employee_teams')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name.trim(),
      status: 'draft',
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as Row, [])
}

/** 更新团队：名称/描述 + 覆盖式设成员（删旧 team_members + 插新，仅 UUID）。
 *  memberIds 已由 API 层门控（仅本租户、本身是数字员工的 agent）。RLS 兜底租户隔离。 */
export async function updateTeam(
  ctx: RequestContext,
  id: string,
  patch: { name?: string; description?: string; memberIds?: string[] },
): Promise<Team | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (typeof patch.description === 'string') fields.description = patch.description

  const { data, error } = await supabase
    .from('digital_employee_teams')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null // 不存在/跨租户 → 不动成员

  // 覆盖式设成员：删旧（unique(team_id,agent_id) → 必须先删再插）+ 插新（仅合法 UUID、去重、不含 null）
  if (patch.memberIds) {
    const { error: delErr } = await supabase.from('team_members').delete().eq('team_id', id)
    if (delErr) throw new Error(delErr.message)
    const ids = [...new Set(patch.memberIds.filter((x) => UUID_RE.test(x)))]
    if (ids.length > 0) {
      const rows = ids.map((agentId, i) => ({ org_id: ctx.orgId, team_id: id, agent_id: agentId, ord: i }))
      const { error: insErr } = await supabase.from('team_members').insert(rows)
      if (insErr) throw new Error(insErr.message)
    }
  }
  return getTeam(ctx, id)
}

/** 软删团队（置 deleted_at）。RLS 兜底：他租户/已删 → false。 */
export async function deleteTeam(_ctx: RequestContext, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('digital_employee_teams')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}
