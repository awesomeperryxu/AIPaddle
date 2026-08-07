import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { TRANSITIONS, type McpTransitionAction, type McpStatus } from '@/lib/mcp/status'

// MCP 连接层（ADR-004 + ADR-023）。
//
// ⚠️ 曾于 ADR-021 被标记为「已弃用、并入 Plugin」，2026-08-07 由 ADR-023 部分回退：
// 合并时没核对字段承接——`plugins` 表根本没有 endpoint / auth_type / auth_config，
// 而 `mcp_servers` 同时失去了写入口。结果是 32 个已发布的 MCP Plugin **全都没有连接信息**，
// 用户按 credentialGuide 的提示去「Plugin → MCP」填 Key，那里压根没有可填的地方。
//
// 现行三层分工：
//   mcp_servers  连接层：endpoint / 认证 / 限流 / 安全等级 / 审批 / 角色·部门授权（本文件）
//   plugins      管理层：目录、市场元数据、发布状态机（lib/data/plugins.ts）
//   tools        调用层：binding_config = { mcp_tool_name, … }，不含 endpoint 与凭证
//
// 数据层（ADR-008）：唯一访问 mcp_servers 表 / my_mcp_servers 视图的地方。
// 首参 ctx、请求级客户端（RLS 生效）。auth_config（凭据引用）绝不出现在 SELECT，不外泄。

export type McpType = 'builtin' | 'enterprise' | 'third_party' | 'private'
export type McpSecurityLevel = 'low' | 'medium' | 'high'

export type McpServer = {
  id: string
  name: string
  description: string
  type: McpType
  endpoint: string
  authType: string
  /** 引用 credentials 表的凭证 id；密文只在服务端解密，绝不外泄（0039） */
  credentialId: string | null
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
  credential_id: string | null
  scope: string | null
  status: McpStatus
  security_level: McpSecurityLevel
  allowed_roles: string[] | null
  allowed_departments: string[] | null
  created_at: string | null
  updated_at: string | null
}

// 🔴 不含 auth_config（可能承载敏感值），不外泄。
// credential_id 只是**引用**，不是密文——前端要靠它显示「已配/未配凭证」，故可查。
// 密文本体在 credentials 表，只有 getCredentialPlaintext 能在服务端解开。
const COLS =
  'id,name,description,type,endpoint,auth_type,credential_id,scope,status,security_level,allowed_roles,allowed_departments,created_at,updated_at'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapRow(r: Row): McpServer {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    type: r.type,
    endpoint: r.endpoint,
    authType: r.auth_type,
    credentialId: r.credential_id ?? null,
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
    /** 引用 credentials 表；密文不经此处，只传 id */
    credentialId?: string | null
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
      credential_id: input.credentialId ?? null,
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
    authType?: string
    /** null = 显式解绑凭证；undefined = 不改动 */
    credentialId?: string | null
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
  if (typeof patch.authType === 'string') fields.auth_type = patch.authType
  // 🔴 用 undefined 判定而非真值判定：null 是「解绑凭证」的合法意图，
  // 写成 if (patch.credentialId) 会让解绑操作被静默忽略。
  if (patch.credentialId !== undefined) fields.credential_id = patch.credentialId
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
