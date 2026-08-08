import 'server-only'

// MCP 传输层：JSON-RPC 2.0 over HTTP，供「发现」与「调用」共用（ADR-024）。
//
// 🔴 为什么要有这一层：在此之前 lib/mcp/discover.ts 与 lib/mcp/client.ts 各写了一套
// HTTP 客户端，行为在四个点上互相矛盾——是否拼接 /mcp、是否 initialize 握手、
// 是否解析 SSE 帧、是否做 SSRF 校验。结果 MCP 页面能拉到工具清单，
// 而 Agent 对话里调同一个 Server 必然失败（client.ts 会把
// https://mcp.notion.com/mcp 拼成 .../mcp/mcp）。
// 8 个已配置真实端点里 7 个含 /mcp 路径，即这条路径几乎全错。
// 协议细节只允许有一个实现，否则修好一边不代表另一边是对的。

/**
 * 认证方案。各家 MCP Server 的 Authorization 头格式并不统一——
 * 2026-08-08 逐家查证官方文档的结论：
 *   bearer        Linear / Stripe / Cloudflare / GitHub(PAT) / Atlassian(服务账号)
 *   sentry_bearer Sentry —— 刻意用 `Sentry-Bearer` 而非 `Bearer`，
 *                 因为 `Bearer` 被它保留给 MCP OAuth token，用错前缀会被当成 OAuth 令牌拒掉
 *   basic         Atlassian 个人 API token —— base64(email:token)
 * 写死 Bearer 会让后两类**永远认证失败**，且报错只是一句 401，看不出是格式问题。
 */
export type McpAuthScheme = 'bearer' | 'sentry_bearer' | 'basic'

export const MCP_AUTH_SCHEMES: readonly McpAuthScheme[] = ['bearer', 'sentry_bearer', 'basic'] as const

export type McpAuth = {
  authType?: string
  secret?: string
  scheme?: McpAuthScheme
  /** basic 方案需要：与 secret 组成 base64(username:secret) */
  username?: string
}

/** SSRF 防护：endpoint 由用户填写，等同任意 URL 输入，不能成为探测内网的入口。 */
const PRIVATE_HOST_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|fe80:|fc00:|fd00:|172\.(1[6-9]|2\d|3[01])\.)/i

export function assertSafeUrl(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (PRIVATE_HOST_RE.test(u.hostname)) return null
  return u
}

/**
 * 解析 MCP 响应体。
 *
 * 🔴 兼容两种传输：Streamable HTTP 直接回 JSON；SSE 传输回 `event: message\ndata: {...}`。
 * 只认前者会让一半 Server 报「协议错误」，而问题其实在我们的解析。
 */
export function parseRpcBody(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed) } catch { return null }
  }
  for (const line of trimmed.split('\n')) {
    const s = line.trim()
    if (!s.startsWith('data:')) continue
    try { return JSON.parse(s.slice(5).trim()) } catch { /* 继续找下一帧 */ }
  }
  return null
}

export function buildAuthHeader(auth: McpAuth): Record<string, string> {
  if (!auth.secret) return {}
  switch (auth.scheme) {
    case 'sentry_bearer':
      return { Authorization: `Sentry-Bearer ${auth.secret}` }
    case 'basic': {
      // 无 username 时按裸 token 处理——总比拼出 base64(":token") 这种一定认证失败的值好
      if (!auth.username) return { Authorization: `Basic ${Buffer.from(auth.secret).toString('base64')}` }
      return { Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.secret}`).toString('base64')}` }
    }
    case 'bearer':
    default:
      return { Authorization: `Bearer ${auth.secret}` }
  }
}

function rpcBody(method: string, params: Record<string, unknown> | undefined, id: number) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
}

export type McpError = {
  code: 'unreachable' | 'auth_failed' | 'protocol_error' | 'blocked'
  message: string
}

/**
 * 建立 MCP 会话：initialize 握手，返回一个可复用的 call 函数。
 *
 * 🔴 endpoint **原样使用，绝不拼接路径**。各家的地址形态本就不同——
 * Stripe 是 https://mcp.stripe.com（无路径），Atlassian 是 /v1/mcp/authv2，
 * 多数是 /mcp。任何自作主张的拼接都会打偏。
 *
 * 🔴 跳过 initialize 直接 tools/list 会被多数 Server 拒绝；
 * Streamable HTTP 传输还要求后续请求带回 initialize 返回的 mcp-session-id。
 */
export async function openMcpSession(
  endpoint: string,
  auth: McpAuth = {},
  timeoutMs = 15_000,
): Promise<
  | { ok: true; serverInfo?: { name?: string; version?: string }; call: (method: string, params?: Record<string, unknown>) => Promise<{ ok: true; result: Record<string, unknown> } | { ok: false } & McpError> }
  | ({ ok: false } & McpError)
> {
  const url = assertSafeUrl(endpoint)
  if (!url) {
    return { ok: false, code: 'blocked', message: 'Endpoint 非法或指向内网/本机地址，已拒绝连接' }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // Streamable HTTP 与 SSE 两种传输都声明接受，由 Server 选
    accept: 'application/json, text/event-stream',
    ...buildAuthHeader(auth),
  }

  let nextId = 1
  const post = async (h: Record<string, string>, method: string, params?: Record<string, unknown>) => {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      return await fetch(url, {
        method: 'POST', headers: h, signal: ctl.signal, cache: 'no-store',
        body: rpcBody(method, params, nextId++),
      })
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    const initRes = await post(headers, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'AIPaddle', version: '1.0' },
    })

    if (initRes.status === 401 || initRes.status === 403) {
      return { ok: false, code: 'auth_failed', message: `认证失败（HTTP ${initRes.status}），请检查 API Key 或 OAuth 授权` }
    }
    if (!initRes.ok) {
      return { ok: false, code: 'protocol_error', message: `握手失败：HTTP ${initRes.status}` }
    }

    const initBody = parseRpcBody(await initRes.text())
    const serverInfo = (initBody?.result as { serverInfo?: { name?: string; version?: string } } | undefined)?.serverInfo

    const sessionId = initRes.headers.get('mcp-session-id')
    const sessionHeaders = sessionId ? { ...headers, 'mcp-session-id': sessionId } : headers

    const call = async (method: string, params?: Record<string, unknown>) => {
      try {
        const res = await post(sessionHeaders, method, params)
        if (res.status === 401 || res.status === 403) {
          return { ok: false as const, code: 'auth_failed' as const, message: `认证失败（HTTP ${res.status}），请检查 API Key 或 OAuth 授权` }
        }
        if (!res.ok) {
          return { ok: false as const, code: 'protocol_error' as const, message: `请求失败：HTTP ${res.status}` }
        }
        const body = parseRpcBody(await res.text())
        if (!body) return { ok: false as const, code: 'protocol_error' as const, message: '响应不是合法的 JSON-RPC' }
        if (body.error) {
          const e = body.error as { message?: string }
          return { ok: false as const, code: 'protocol_error' as const, message: e.message ?? '服务返回错误' }
        }
        return { ok: true as const, result: (body.result ?? {}) as Record<string, unknown> }
      } catch (e) {
        return { ok: false as const, ...toUnreachable(e) }
      }
    }

    return { ok: true, serverInfo, call }
  } catch (e) {
    return { ok: false, ...toUnreachable(e) }
  }
}

function toUnreachable(e: unknown): McpError {
  const msg = e instanceof Error ? e.message : String(e)
  const aborted = /abort/i.test(msg)
  return {
    code: 'unreachable',
    message: aborted ? '连接超时——请确认服务地址可从服务器访问' : `无法连接：${msg}`,
  }
}
