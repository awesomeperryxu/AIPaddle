import 'server-only'
import { randomBytes } from 'crypto'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  /** 是否已具备机器用户身份。只暴露有无，不外泄 id——它是签发令牌的依据，等同凭证 */
  hasServiceUser: boolean
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS =
  'id,name,description,kind,target_type,target_id,target_version,allowed_origins,rate_limit_per_min,status,service_user_id,created_at'

type Row = {
  id: string; name: string; description: string | null; kind: string
  target_type: string; target_id: string; target_version: string | null
  allowed_origins: unknown; rate_limit_per_min: number | null
  status: string; service_user_id: string | null; created_at: string | null
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
    hasServiceUser: !!r.service_user_id,
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

  // 🔴 机器用户（ADR-020 §3）——没有它，Extension 发布后外部调用必然 503。
  // 全库 79 条 RLS 策略都走 current_org_id() = `select org_id from users where id = auth.uid()`，
  // 外部 Key 调用没有 Supabase 会话，auth.uid() 为空则一条数据都查不到。
  // 这里用 service_role 是 ADR-002 允许的「Auth 用户管理」用途：建 auth.users 只能由它完成，
  // 且属管理操作而非应答外部请求。建完之后外部调用一律走请求级客户端，不再碰这把钥匙。
  const admin = createAdminClient()
  const email = `ext-${randomBytes(8).toString('hex')}@service.aipaddle.local`
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    // 随机且不留存：本方案用自签短期令牌换身份，不走密码登录（ADR-020 §3 路径 A）
    password: randomBytes(32).toString('hex'),
    email_confirm: true,
  })
  if (authErr || !created?.user?.id) {
    throw new Error(`创建机器用户失败：${authErr?.message ?? '未知错误'}`)
  }
  const serviceUserId = created.user.id

  // 任一步失败都要清干净，否则会留下既登录不了又占位的孤儿账号
  const rollback = async () => {
    await admin.from('users').delete().eq('id', serviceUserId)
    await admin.auth.admin.deleteUser(serviceUserId).catch(() => {})
  }

  // public.users 行必须有 —— current_org_id() 查的正是这张表，缺了 RLS 认不出身份
  const { error: profileErr } = await admin.from('users').insert({
    id: serviceUserId,
    org_id: ctx.orgId,
    email,
    name: `[扩展] ${name}`,
    is_service_account: true,   // 成员列表与计费口径须显式排除此标记
  })
  if (profileErr) {
    await rollback()
    throw new Error(`创建机器用户档案失败：${profileErr.message}`)
  }

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
      service_user_id: serviceUserId,
    })
    .select(COLS).single()
  if (error) {
    await rollback()
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
    targetId?: string
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
  if (typeof patch.targetId === 'string' && UUID_RE.test(patch.targetId)) fields.target_id = patch.targetId
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
    .select('id,service_user_id').maybeSingle()
  if (error) throw new Error(error.message)
  if (data) {
    // 顺序要紧：先撤 Key 立刻断掉外部调用，再清机器用户身份。
    // 反过来的话，Key 还有效而身份已没了，外部会收到一串 503 而不是干脆的 401。
    await supabase.from('api_keys')
      .update({ revoked_at: now, updated_at: now })
      .eq('extension_id', id).eq('org_id', ctx.orgId).is('revoked_at', null)

    const sid = (data as { id: string; service_user_id?: string | null }).service_user_id
    if (sid) {
      const admin = createAdminClient()
      await admin.from('users').delete().eq('id', sid)
      await admin.auth.admin.deleteUser(sid).catch(() => {})
    }
    return 'deleted'
  }

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
  | { ok: false; reason: 'not_found' | 'illegal' | 'no_service_user' }

export async function transitionExtension(
  ctx: RequestContext,
  id: string,
  action: ExtTransitionAction,
): Promise<ExtTransitionResult> {
  const t = EXT_TRANSITIONS[action]
  if (!t) return { ok: false, reason: 'illegal' }
  if (!UUID_RE.test(id)) return { ok: false, reason: 'not_found' }

  const supabase = await createClient()
  // 🔴 发布前必须已有机器用户：没有它，上线后外部一调就是 503。
  // 宁可在发布这一步挡住，也不让它"看起来发布成功"却对外不可用（ADR-020 §3）。
  if (t.to === 'published') {
    const { data: row } = await supabase
      .from('extensions').select('service_user_id')
      .eq('id', id).eq('org_id', ctx.orgId).is('deleted_at', null)
      .maybeSingle()
    if (row && !(row as { service_user_id: string | null }).service_user_id) {
      return { ok: false, reason: 'no_service_user' }
    }
  }
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
