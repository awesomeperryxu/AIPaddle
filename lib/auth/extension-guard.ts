import 'server-only'
import { getExtensionContext, hasScope, type ExtensionContext } from './extension-context'

// V12-8.8 / ADR-020 §6-§7：对外端点的治理闸门——来源白名单 + 限流 + 统一错误形状。
// 所有 /api/ext/v1/* 都从这里进，避免每个端点各写一遍鉴权（漏一个就是一个洞）。

export type GuardFailure = { response: Response }
export type GuardSuccess = { ctx: ExtensionContext; origin: string | null }

/** 统一错误响应。不透露"Key 不存在"还是"已撤销"，不给探测者可用的信号。 */
function fail(status: number, code: string, message: string, headers: HeadersInit = {}): Response {
  return Response.json({ error: { code, message } }, { status, headers })
}

// ── 限流（ADR-020 §7）──────────────────────────────────────────
// 首版进程内计数。🔴 多实例部署下每个实例各算各的，等于放宽 N 倍——当前是单实例
// PM2，可接受；扩实例前必须换 Redis。口子收在这一个函数里，换实现不影响调用方。
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function checkRate(key: string, limitPerMin: number): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 })
    return { ok: true }
  }
  if (b.count >= limitPerMin) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  b.count += 1
  return { ok: true }
}

// 定期清理过期桶，避免 Map 无限增长（外部 IP 数量不可控）
function sweep() {
  const now = Date.now()
  for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
}

/** 取客户端 IP：优先反代注入的 X-Forwarded-For 首段。 */
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * 来源校验（ADR-020 §6）。
 * - 白名单非空：Origin 必须命中，否则 403；无 Origin 的服务端调用放行。
 * - 白名单为空：视为「仅服务端调用」，**带 Origin 的请求一律拒绝**，浏览器直连自然被挡。
 */
function checkOrigin(origin: string | null, allowed: string[]): boolean {
  if (!origin) return true // 服务端调用（BFF 代理）不带 Origin
  if (allowed.length === 0) return false
  return allowed.includes(origin)
}

/** CORS 响应头：只回具体来源，绝不回 `*`（回 * 等于白名单形同虚设）。 */
export function corsHeaders(origin: string | null, allowed: string[]): HeadersInit {
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/**
 * 对外端点统一入口：验 Key → 验来源 → 验 scope → 限流。
 * 任一不过返回 { response }，调用方直接 return 它。
 */
export async function guardExtensionRequest(
  req: Request,
  requiredScope: string,
): Promise<GuardFailure | GuardSuccess> {
  const auth = await getExtensionContext(req)
  if (!auth.ok) {
    const map: Record<string, [number, string]> = {
      missing_key: [401, '缺少 API Key'],
      invalid_key: [401, 'API Key 无效'],
      no_identity: [503, '扩展未完成初始化'],
      tenant_suspended: [403, '租户已停用'],
    }
    const [status, message] = map[auth.error] ?? [401, '未授权']
    return { response: fail(status, auth.error, message) }
  }

  const ctx = auth.ctx
  const origin = req.headers.get('origin')

  if (!checkOrigin(origin, ctx.allowedOrigins)) {
    return { response: fail(403, 'origin_not_allowed', '来源不在白名单内') }
  }

  if (!hasScope(ctx, requiredScope)) {
    return { response: fail(403, 'scope_denied', `缺少权限：${requiredScope}`) }
  }

  sweep()
  const limit = ctx.rateLimitPerMin ?? 60
  for (const [scope, id] of [['key', ctx.keyId], ['ip', clientIp(req)]] as const) {
    const r = checkRate(`${scope}:${id}`, limit)
    if (!r.ok) {
      return {
        response: fail(429, 'rate_limited', '请求过于频繁，请稍后再试', {
          'Retry-After': String(r.retryAfter),
          ...corsHeaders(origin, ctx.allowedOrigins),
        }),
      }
    }
  }

  return { ctx, origin }
}

/** 预检请求：只回白名单内的来源。 */
export function handleOptions(req: Request, allowed: string[]): Response {
  const origin = req.headers.get('origin')
  return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) })
}

/** 仅供测试重置限流状态。 */
export function __resetRateLimit() {
  buckets.clear()
}
