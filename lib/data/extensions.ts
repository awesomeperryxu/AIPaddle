import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import {
  EXT_TRANSITIONS, type ExtTransitionAction, type ExtensionStatus,
} from '@/lib/extensions/status'

// V12-8.4 / ADR-020：Extension 数据层（ADR-008 四层依赖，请求级客户端，RLS 生效）。
//
// Extension = 供**外部应用调用 AIPaddle** 的受治理入口，与 Plugin 方向相反。
// 本期只做 API Endpoint 一类。

export type ExtensionKind = 'api' | 'webhook' | 'channel' | 'widget'
export type ExtensionTargetType = 'agent' | 'workflow'

export type Extension = {
  id: string
  name: string
  description: string
  kind: ExtensionKind
  targetType: ExtensionTargetType
  targetId: string
  targetVersion: string | null
  allowedOrigins: string[]
  rateLimitPerMin: number
  status: ExtensionStatus
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS =
  'id,name,description,kind,target_type,target_id,target_version,allowed_origins,rate_limit_per_min,status,created_at'

type Row = {
  id: string; name: string; description: string | null; kind: string
  target_type: string; target_id: string; target_version: string | null
  allowed_origins: unknown; rate_limit_per_min: number | null
  status: string; created_at: string | null
}

function mapRow(r: Row): Extension {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    kind: (r.kind as ExtensionKind) ?? 'api',
    targetType: r.target_type as ExtensionTargetType,
    targetId: r.target_id,
    targetVersion: r.target_version,
    allowedOrigins: Array.isArray(r.allowed_origins) ? (r.allowed_origins as string[]) : [],
    rateLimitPerMin: r.rate_limit_per_min ?? 60,
    status: r.status as ExtensionStatus,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

/** 入参校验失败 → 路由回 400/422，而非 500。 */
export class ExtensionValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ExtensionValidationError' }
}

/**
 * Origin 白名单校验。
 *
 * 🔴 只接受 scheme://host[:port] 形式，**不接受路径与通配符**：
 * 浏览器发出的 `Origin` 头本身就不含路径，白名单里写路径永远匹配不上（静默失效）；
 * 通配符 `*` 则等于对全网敞开，与「默认拒绝」的取向相反。
 */
export function assertOrigins(origins: unknown): string[] {
  if (!Array.isArray(origins)) throw new ExtensionValidationError('来源白名单必须是数组')
  const out: string[] = []
  for (const o of origins) {
    if (typeof o !== 'string' || !o.trim()) throw new ExtensionValidationError('来源不能为空')
    const v = o.trim()
    if (v === '*') throw new ExtensionValidationError('不接受通配符 *：等于对全网开放')
    let u: URL
    try { u = new URL(v) } catch { throw new ExtensionValidationError(`来源格式无效：${v}（应形如 https://example.com）`) }
    if (u.pathname !== '/' || u.search || u.hash) {
      throw new ExtensionValidationError(`来源不应含路径或参数：${v}（Origin 头本身不含路径，写了永远匹配不上）`)
    }
    out.push(u.origin)
  }
  return [...new Set(out)]
}

export async function listExtensions(ctx: RequestContext): Promise<Extension[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extensions').select(COLS)
    .eq('org_id', ctx.orgId)          // RLS + 显式 org_id 双层隔离（CLAUDE.md 铁律）
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(mapRow)
}

export async function getExtensionById(ctx: RequestContext, id: string): Promise<Extension | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extensions').select(COLS)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

export async function createExtension(
  ctx: RequestContext,
  input: {
    name: string; description?: string
    targetType: ExtensionTargetType; targetId: string
    targetVersion?: string | null
    allowedOrigins?: unknown
    rateLimitPerMin?: number
  },
): Promise<Extension> {
  const name = input.name?.trim()
  if (!name) throw new ExtensionValidationError('名称不能为空')
  if (!UUID_RE.test(input.targetId)) throw new ExtensionValidationError('调用目标无效')
  if (input.targetType !== 'agent' && input.targetType !== 'workflow') {
    throw new ExtensionValidationError('调用目标类型只能是 agent 或 workflow')
  }
  const origins = assertOrigins(input.allowedOrigins ?? [])
  const rate = input.rateLimitPerMin ?? 60
  if (!Number.isInteger(rate) || rate < 0) throw new ExtensionValidationError('限流值必须为非负整数')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extensions')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name,
      description: input.description ?? null,
      kind: 'api',                       // 本期只做 API Endpoint
      target_type: input.targetType,
      target_id: input.targetId,
      target_version: input.targetVersion ?? null,
      allowed_origins: origins,
      rate_limit_per_min: rate,
      status: 'draft',                   // 一律 draft，发布须走状态机
    })
    .select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new ExtensionValidationError('同名扩展已存在')
    throw new Error(error.message)
  }
  return mapRow(data as Row)
}

export async function updateExtension(
  ctx: RequestContext,
  id: string,
  patch: {
    name?: string; description?: string
    allowedOrigins?: unknown; rateLimitPerMin?: number
    targetVersion?: string | null
  },
): Promise<Extension | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') {
    const n = patch.name.trim()
    if (!n) throw new ExtensionValidationError('名称不能为空')
    fields.name = n
  }
  if (typeof patch.description === 'string') fields.description = patch.description
  if (patch.allowedOrigins !== undefined) fields.allowed_origins = assertOrigins(patch.allowedOrigins)
  if (patch.rateLimitPerMin !== undefined) {
    if (!Number.isInteger(patch.rateLimitPerMin) || patch.rateLimitPerMin < 0) {
      throw new ExtensionValidationError('限流值必须为非负整数')
    }
    fields.rate_limit_per_min = patch.rateLimitPerMin
  }
  if (patch.targetVersion !== undefined) fields.target_version = patch.targetVersion
  if (Object.keys(fields).length === 0) return getExtensionById(ctx, id)
  fields.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extensions').update(fields)
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .select(COLS).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

/** 软删。已发布的必须先下线——外部还在调用时删掉会让接入方毫无预警地断流。 */
export type DeleteExtResult = 'deleted' | 'not_found' | 'published'

export async function deleteExtension(ctx: RequestContext, id: string): Promise<DeleteExtResult> {
  if (!UUID_RE.test(id)) return 'not_found'
  const supabase = await createClient()
  const now = new Date().toISOString()
  // 拦截条件写进 update 本身，不先查后写——避免「查到是 offline → 期间被上线 → 仍删掉」的并发窗口
  const { data, error } = await supabase
    .from('extensions').update({ deleted_at: now, updated_at: now })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .neq('status', 'published')
    .select('id').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return 'deleted'

  // 0 行有两种原因，回查仅用于区分错误码（不参与是否删除的判定）
  const { data: exist } = await supabase
    .from('extensions').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .maybeSingle()
  return (exist as { status?: string } | null)?.status === 'published' ? 'published' : 'not_found'
}

/** 状态机流转。非法流转返回 illegal → 路由回 409（请求合法，是与当前状态冲突）。 */
export type ExtTransitionResult =
  | { ok: true; status: ExtensionStatus }
  | { ok: false; reason: 'not_found' | 'illegal' }

export async function transitionExtension(
  ctx: RequestContext,
  id: string,
  action: ExtTransitionAction,
): Promise<ExtTransitionResult> {
  const t = EXT_TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }

  const supabase = await createClient()
  // 用 from 态作为 update 条件：当前态不符即 0 行 → 非法流转。
  // 单条语句关掉并发窗口（同 deleteAgent 的做法）。
  const { data, error } = await supabase
    .from('extensions')
    .update({ status: t.to, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .eq('status', t.from)
    .select('status').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return { ok: true, status: (data as { status: string }).status as ExtensionStatus }

  const { data: exist } = await supabase
    .from('extensions').select('status')
    .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
    .maybeSingle()
  return exist ? { ok: false, reason: 'illegal' } : { ok: false, reason: 'not_found' }
}
