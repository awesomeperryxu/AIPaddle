import 'server-only'

// MCP tools 动态发现（ADR-024）。
//
// 规范：客户端不预注册 tools，运行时通过 `tools/list` 向 Server 拉取；
// Server 可通过 notifications/tools/list_changed 通知变更。
// 因此平台不落静态 tools 副本——那份副本从产生的那一刻就在过期。
//
// 🔴 这里只做「发现」，不做「调用」：调用走 lib/mcp/invoke.ts，
// 两者分文件是刻意的——发现是只读探测，调用会产生副作用，风险不是一个量级
// （与 lib/tools/run.ts 和 lib/skills/invoke.ts 分开是同一考虑）。

export type McpTool = {
  name: string
  description: string
  /** JSON Schema，供 Function Calling 使用 */
  inputSchema: Record<string, unknown>
}

export type DiscoverResult =
  | { ok: true; tools: McpTool[]; serverInfo?: { name?: string; version?: string } }
  | { ok: false; code: 'unreachable' | 'auth_failed' | 'protocol_error' | 'blocked'; message: string }

// SSRF 防护：与 lib/workflow/execute.ts 同一套判定，避免 MCP 成为绕过内网限制的入口
const PRIVATE_HOST_RE =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|fe80:|fc00:|fd00:|172\.(1[6-9]|2\d|3[01])\.)/i

function assertSafeUrl(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (PRIVATE_HOST_RE.test(u.hostname)) return null
  return u
}

/** JSON-RPC 2.0 请求体 */
function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
}

/**
 * 解析 MCP 响应。
 *
 * 🔴 兼容两种传输：Streamable HTTP 直接回 JSON；SSE 传输回 `event: message\ndata: {...}`。
 * 只认前者会让一半的 Server 报「协议错误」，而问题其实出在我们没解析 SSE 帧。
 */
function parseRpcBody(text: string): Record<string, unknown> | null {
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

function authHeaders(authType: string, secret?: string): Record<string, string> {
  if (!secret) return {}
  // MCP 远程服务普遍走 Bearer；api_key 型也多用 Authorization 头承载
  return { Authorization: `Bearer ${secret}` }
}

/**
 * 连接 MCP Server 并拉取其 tools 清单。
 *
 * 失败一律返回结构化原因而非抛错——调用方要把「连不上」如实展示给用户，
 * 而不是让整个页面 500。
 */
export async function discoverMcpTools(
  endpoint: string,
  opts: { authType?: string; secret?: string; timeoutMs?: number } = {},
): Promise<DiscoverResult> {
  const url = assertSafeUrl(endpoint)
  if (!url) {
    return { ok: false, code: 'blocked', message: 'Endpoint 非法或指向内网/本机地址，已拒绝连接' }
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15_000)
  const headers = {
    'content-type': 'application/json',
    // Streamable HTTP 与 SSE 两种传输都声明接受，由 Server 选
    accept: 'application/json, text/event-stream',
    ...authHeaders(opts.authType ?? 'none', opts.secret),
  }

  try {
    // ① initialize：协议握手。跳过它直接 tools/list 会被多数 Server 拒绝
    const initRes = await fetch(url, {
      method: 'POST', headers, signal: ctl.signal, cache: 'no-store',
      body: rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'AIPaddle', version: '1.0' },
      }),
    })

    if (initRes.status === 401 || initRes.status === 403) {
      return { ok: false, code: 'auth_failed', message: `认证失败（HTTP ${initRes.status}），请检查 API Key 或 OAuth 授权` }
    }
    if (!initRes.ok) {
      return { ok: false, code: 'protocol_error', message: `握手失败：HTTP ${initRes.status}` }
    }

    const initBody = parseRpcBody(await initRes.text())
    const serverInfo = (initBody?.result as { serverInfo?: { name?: string; version?: string } } | undefined)?.serverInfo

    // 会话 id：Streamable HTTP 传输要求后续请求带上
    const sessionId = initRes.headers.get('mcp-session-id')
    const nextHeaders = sessionId ? { ...headers, 'mcp-session-id': sessionId } : headers

    // ② tools/list：真正的发现
    const listRes = await fetch(url, {
      method: 'POST', headers: nextHeaders, signal: ctl.signal, cache: 'no-store',
      body: rpc('tools/list', undefined, 2),
    })
    if (!listRes.ok) {
      return { ok: false, code: 'protocol_error', message: `拉取工具清单失败：HTTP ${listRes.status}` }
    }

    const body = parseRpcBody(await listRes.text())
    if (!body) return { ok: false, code: 'protocol_error', message: '响应不是合法的 JSON-RPC' }
    if (body.error) {
      const e = body.error as { message?: string }
      return { ok: false, code: 'protocol_error', message: e.message ?? '服务返回错误' }
    }

    const raw = (body.result as { tools?: unknown } | undefined)?.tools
    if (!Array.isArray(raw)) {
      return { ok: false, code: 'protocol_error', message: '响应中缺少 tools 列表' }
    }

    const tools: McpTool[] = raw.map((t) => {
      const tt = t as Record<string, unknown>
      return {
        name: String(tt.name ?? ''),
        description: String(tt.description ?? ''),
        inputSchema: (tt.inputSchema ?? tt.input_schema ?? {}) as Record<string, unknown>,
      }
    }).filter((t) => t.name)

    return { ok: true, tools, serverInfo }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const aborted = /abort/i.test(msg)
    return {
      ok: false,
      code: 'unreachable',
      message: aborted ? '连接超时——请确认服务地址可从服务器访问' : `无法连接：${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }
}
