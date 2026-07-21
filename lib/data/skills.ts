import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import {
  TRANSITIONS,
  submitTargetForRisk,
  type SkillTransitionAction,
  type SkillStatus,
  type SkillType,
} from '@/lib/skills/status'

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
  mine: boolean // 是否本人发布（区分"我创建"与"从市场安装"）
  origin: SkillOrigin // 平台/用户
  mandatory: boolean // 类一 平台内置强制
  category: SkillCategory // 四类派生
}

// Skill 四类来源分类（#46）
export type SkillOrigin = 'platform' | 'user'
export type SkillCategory = 'platform-builtin' | 'platform-market' | 'user-private' | 'user-shared'

function deriveCategory(origin: SkillOrigin, mandatory: boolean, status: SkillStatus): SkillCategory {
  if (origin === 'platform') return mandatory ? 'platform-builtin' : 'platform-market'
  return status === 'draft' ? 'user-private' : 'user-shared'
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
  publisher_id: string
  origin: SkillOrigin
  mandatory: boolean
  created_at: string | null
  updated_at: string | null
}

const COLS =
  'id,name,description,type,version,installs,rating,risk_level,status,tags,config,publisher_id,origin,mandatory,created_at,updated_at'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapRow(r: Row, userId?: string): Skill {
  const origin: SkillOrigin = r.origin === 'platform' ? 'platform' : 'user'
  const mandatory = !!r.mandatory
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
    mine: !!userId && r.publisher_id === userId,
    origin,
    mandatory,
    category: deriveCategory(origin, mandatory, r.status),
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
  return (data as Row[] | null ?? []).map((r) => mapRow(r, _ctx.userId))
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
  return data ? mapRow(data as Row, _ctx.userId) : null
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

// 提交发布（S3-04 风险分级）：低风险 draft→published 自动通过；中/高风险 draft→pending 须审核。
// 原子条件更新，from 固定 draft。返回 auto=是否自动发布。
export async function submitSkill(
  ctx: RequestContext,
  id: string,
): Promise<{ ok: true; skill: Skill; auto: boolean } | { ok: false; reason: 'not_found' | 'illegal' }> {
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }
  const cur = await getSkillById(ctx, id)
  if (!cur) return { ok: false, reason: 'not_found' }
  if (cur.status !== 'draft') return { ok: false, reason: 'illegal' }
  const to = submitTargetForRisk(cur.riskLevel)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .update({ status: to })
    .eq('id', id)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, skill: mapRow(data as Row), auto: to === 'published' }
  const now = await getSkillById(ctx, id)
  return { ok: false, reason: now ? 'illegal' : 'not_found' }
}

// 重算安装量并回写 skills.installs（避免计数漂移）。RLS 兜底：只统计本租户安装记录。
async function recomputeInstalls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillId: string,
): Promise<number> {
  const { count } = await supabase
    .from('skill_installs')
    .select('id', { count: 'exact', head: true })
    .eq('skill_id', skillId)
    .is('deleted_at', null)
  const n = count ?? 0
  await supabase.from('skills').update({ installs: n }).eq('id', skillId)
  return n
}

// 安装 Skill（S3-03）。只能装已发布；幂等（unique(skill_id,user_id) + upsert，重复安装计数不变）。
// 跨租户不可见：RLS 使他租户 skill 查不到 → not_found。
export async function installSkill(
  ctx: RequestContext,
  skillId: string,
): Promise<{ ok: true; installs: number } | { ok: false; reason: 'not_found' | 'not_published' }> {
  if (!UUID_RE.test(skillId)) return { ok: false, reason: 'not_found' }
  const skill = await getSkillById(ctx, skillId)
  if (!skill) return { ok: false, reason: 'not_found' }
  if (skill.status !== 'published') return { ok: false, reason: 'not_published' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('skill_installs')
    .upsert(
      { org_id: ctx.orgId, skill_id: skillId, user_id: ctx.userId, deleted_at: null },
      { onConflict: 'skill_id,user_id' },
    )
  if (error) throw new Error(error.message)
  return { ok: true, installs: await recomputeInstalls(supabase, skillId) }
}

// 卸载 Skill（S3-03）。幂等：未安装也返回 ok。他租户 skill → not_found。
export async function uninstallSkill(
  ctx: RequestContext,
  skillId: string,
): Promise<{ ok: true; installs: number } | { ok: false; reason: 'not_found' }> {
  if (!UUID_RE.test(skillId)) return { ok: false, reason: 'not_found' }
  const skill = await getSkillById(ctx, skillId)
  if (!skill) return { ok: false, reason: 'not_found' }
  const supabase = await createClient()
  await supabase
    .from('skill_installs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('skill_id', skillId)
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
  return { ok: true, installs: await recomputeInstalls(supabase, skillId) }
}

// 当前用户已安装的 skill_id 列表（供前端标注安装态）。RLS 兜底本租户。
export async function listInstalledSkillIds(ctx: RequestContext): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skill_installs')
    .select('skill_id')
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => (r as { skill_id: string }).skill_id)
}

// 升版本（S3-05）。当前版本快照进 config.versions（旧版本仍可查），version 置新值。
// 无版本历史表 → 用 config jsonb 承载（改表须过 A 道，本切片不改表）。
export async function bumpSkillVersion(
  ctx: RequestContext,
  id: string,
  newVersion: string,
): Promise<Skill | null> {
  if (!UUID_RE.test(id)) return null
  const cur = await getSkillById(ctx, id)
  if (!cur) return null
  const prevVersions = Array.isArray(cur.config.versions) ? (cur.config.versions as unknown[]) : []
  const { versions: _drop, ...configNoHistory } = cur.config
  const newConfig: SkillConfig = {
    ...cur.config,
    versions: [...prevVersions, { version: cur.version, config: configNoHistory, at: new Date().toISOString() }],
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .update({ version: newVersion, config: newConfig })
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}
