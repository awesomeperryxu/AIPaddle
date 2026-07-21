import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TRANSITIONS, type SkillTransitionAction, type SkillStatus, type SkillType } from '@/lib/skills/status'

// 数据层（ADR-008）：唯一访问 skills 表的地方。首参 ctx、请求级客户端（RLS 生效）。
// config jsonb 承载各类型的封装配置；MCP 型放 { mcp_server_id, allowed_tools }（S3-09）。

export type RiskLevel = 'low' | 'medium' | 'high'
export type SkillConfig = { mcp_server_id?: string; allowed_tools?: string[]; [k: string]: unknown }

export type Skill = {
  id: string
  name: string
  description: string
  type: SkillType
  version: string
  installs: number
  rating: number
  riskLevel: RiskLevel
  status: SkillStatus
  tags: string[]
  config: SkillConfig
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  name: string
  description: string | null
  type: SkillType
  version: string
  installs: number | null
  rating: number | null
  risk_level: RiskLevel
  status: SkillStatus
  tags: string[] | null
  config: SkillConfig | null
  created_at: string | null
  updated_at: string | null
}

const COLS =
  'id,name,description,type,version,installs,rating,risk_level,status,tags,config,created_at,updated_at'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapRow(r: Row): Skill {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    type: r.type,
    version: r.version,
    installs: Number(r.installs ?? 0),
    rating: Number(r.rating ?? 0),
    riskLevel: r.risk_level,
    status: r.status,
    tags: r.tags ?? [],
    config: r.config ?? {},
    createdAt: (r.created_at ?? '').slice(0, 10),
    updatedAt: r.updated_at ?? '',
  }
}

export async function listSkills(_ctx: RequestContext): Promise<Skill[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .select(COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Row[] | null ?? []).map(mapRow)
}

export async function getSkillById(_ctx: RequestContext, id: string): Promise<Skill | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .select(COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function createSkill(
  ctx: RequestContext,
  input: {
    name: string
    type: SkillType
    description?: string
    riskLevel?: RiskLevel
    tags?: string[]
    config?: SkillConfig
  },
): Promise<Skill> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .insert({
      org_id: ctx.orgId,
      publisher_id: ctx.userId,
      name: input.name.trim(),
      type: input.type,
      description: input.description ?? null,
      risk_level: input.riskLevel ?? 'low',
      tags: input.tags ?? [],
      config: input.config ?? {},
      status: 'draft', // 创建一律 draft，发布须走审核（submit→approve）
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as Row)
}

export async function updateSkill(
  _ctx: RequestContext,
  id: string,
  patch: {
    name?: string
    description?: string
    riskLevel?: RiskLevel
    tags?: string[]
    config?: SkillConfig
  },
): Promise<Skill | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (typeof patch.description === 'string') fields.description = patch.description
  if (patch.riskLevel) fields.risk_level = patch.riskLevel
  if (Array.isArray(patch.tags)) fields.tags = patch.tags
  if (patch.config !== undefined) fields.config = patch.config
  if (Object.keys(fields).length === 0) return getSkillById(_ctx, id)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function deleteSkill(_ctx: RequestContext, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

// 状态机流转（S3-02）。原子条件更新：仅当当前 status===from 才落库，
// 否则 0 行 → 再查一次区分 not_found / illegal。
export async function transitionSkill(
  _ctx: RequestContext,
  id: string,
  action: SkillTransitionAction,
): Promise<{ ok: true; skill: Skill } | { ok: false; reason: 'not_found' | 'illegal' }> {
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }
  const t = TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .update({ status: t.to as SkillStatus })
    .eq('id', id)
    .eq('status', t.from)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, skill: mapRow(data as Row) }
  const current = await getSkillById(_ctx, id)
  return { ok: false, reason: current ? 'illegal' : 'not_found' }
}
