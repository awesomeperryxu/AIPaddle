import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TRANSITIONS, type McpTransitionAction, type McpStatus } from '@/lib/mcp/status'

// 数据层（ADR-008）：唯一访问 mcp_servers 表 / my_mcp_servers 视图的地方。
// 首参 ctx、请求级客户端（RLS 生效）。auth_config（Vault 凭据引用）绝不出现在 SELECT，不外泄。

export type McpType = 'builtin' | 'enterprise' | 'third_party' | 'private'
export type McpSecurityLevel = 'low' | 'medium' | 'high'

export type McpServer = {
  id: string
  name: string
  description: string
  type: McpType
  endpoint: string
  authType: string
  scope: string
  status: McpStatus
  securityLevel: McpSecurityLevel
  allowedRoles: string[]
  allowedDepartments: string[]
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  name: string
  description: string | null
  type: McpType
  endpoint: string
  auth_type: string
  scope: string | null
  status: McpStatus
  security_level: McpSecurityLevel
  allowed_roles: string[] | null
  allowed_departments: string[] | null
  created_at: string | null
  updated_at: string | null
}

// 注意：不含 auth_config（凭据），不外泄
const COLS =
  'id,name,description,type,endpoint,auth_type,scope,status,security_level,allowed_roles,allowed_departments,created_at,updated_at'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapRow(r: Row): McpServer {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    type: r.type,
    endpoint: r.endpoint,
    authType: r.auth_type,
    scope: r.scope ?? '',
    status: r.status,
    securityLevel: r.security_level,
    allowedRoles: r.allowed_roles ?? [],
    allowedDepartments: r.allowed_departments ?? [],
    createdAt: (r.created_at ?? '').slice(0, 10),
    updatedAt: r.updated_at ?? '',
  }
}

// 管理端全量清单（含 draft/pending/disabled）。RLS 只放行本租户。权限 mcp:read 在 API 层校验。
export async function listMcpServers(_ctx: RequestContext): Promise<McpServer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .select(COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Row[] | null ?? []).map(mapRow)
}

// 当前用户按角色+部门可见的已审批清单（S3-08）。走 my_mcp_servers 视图——过滤在 SQL 内完成，
// 无权限角色/部门天然查不到（列表不出现）。供 Skill 创建表单 Server 下拉。
export async function listMyMcpServers(_ctx: RequestContext): Promise<McpServer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('my_mcp_servers')
    .select(COLS)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Row[] | null ?? []).map(mapRow)
}

// 按 id 取单个。RLS 兜底：他租户 id 查不到 → null → 路由 404。非法 UUID 直接当不存在。
export async function getMcpServerById(_ctx: RequestContext, id: string): Promise<McpServer | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .select(COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function createMcpServer(
  ctx: RequestContext,
  input: {
    name: string
    endpoint: string
    type?: McpType
    description?: string
    scope?: string
    authType?: string
    securityLevel?: McpSecurityLevel
    allowedRoles?: string[]
    allowedDepartments?: string[]
  },
): Promise<McpServer> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name.trim(),
      endpoint: input.endpoint.trim(),
      type: input.type ?? 'enterprise',
      description: input.description ?? null,
      scope: input.scope ?? null,
      auth_type: input.authType ?? 'api_key',
      security_level: input.securityLevel ?? 'medium',
      allowed_roles: input.allowedRoles ?? ['Admin'],
      allowed_departments: input.allowedDepartments ?? [],
      status: 'draft', // 注册一律 draft，须走审核（submit→approve）后才可被 Skill 引用
    })
    .select(COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as Row)
}

export async function updateMcpServer(
  _ctx: RequestContext,
  id: string,
  patch: {
    name?: string
    description?: string
    endpoint?: string
    scope?: string
    securityLevel?: McpSecurityLevel
    allowedRoles?: string[]
    allowedDepartments?: string[]
  },
): Promise<McpServer | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (typeof patch.description === 'string') fields.description = patch.description
  if (typeof patch.endpoint === 'string') fields.endpoint = patch.endpoint.trim()
  if (typeof patch.scope === 'string') fields.scope = patch.scope
  if (patch.securityLevel) fields.security_level = patch.securityLevel
  if (Array.isArray(patch.allowedRoles)) fields.allowed_roles = patch.allowedRoles
  if (Array.isArray(patch.allowedDepartments)) fields.allowed_departments = patch.allowedDepartments
  if (Object.keys(fields).length === 0) return getMcpServerById(_ctx, id)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

// 软删除。他租户 id 或已删行影响 0 行 → false → 路由 404，幂等。
export async function deleteMcpServer(_ctx: RequestContext, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

// 审批/启停状态机流转。原子条件更新：仅当当前 status===from 才落库，
// 否则 0 行 → 再查一次区分 not_found / illegal。
export async function transitionMcpServer(
  _ctx: RequestContext,
  id: string,
  action: McpTransitionAction,
): Promise<{ ok: true; server: McpServer } | { ok: false; reason: 'not_found' | 'illegal' }> {
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }
  const t = TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_servers')
    .update({ status: t.to as McpStatus })
    .eq('id', id)
    .eq('status', t.from)
    .is('deleted_at', null)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, server: mapRow(data as Row) }
  const current = await getMcpServerById(_ctx, id)
  return { ok: false, reason: current ? 'illegal' : 'not_found' }
}
