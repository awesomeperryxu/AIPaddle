import 'server-only'

// MCP HTTP 客户端（Path B 直连）
// 基于 MCP 规范的 JSON-RPC 2.0 over HTTP 实现。
// 支持 api_key / none 鉴权（auth_config 中的 api_key 字段）；其他类型预留扩展点。

export type McpTool = {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export type McpToolResult = {
  content: { type: string; text?: string }[]
  isError?: boolean
}

type AuthConfig = Record<string, string>

function buildHeaders(authType: string, authConfig: AuthConfig): Record<string, string> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authType === 'api_key' && authConfig.api_key) {
    base['Authorization'] = `Bearer ${authConfig.api_key}`
  }
  return base
}

async function rpcPost(endpoint: string, authType: string, authConfig: AuthConfig, method: string, params: unknown): Promise<unknown> {
  const url = endpoint.replace(/\/$/, '') + '/mcp'
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(authType, authConfig),
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json() as { result?: unknown; error?: { message?: string } }
  if (!res.ok || json.error) {
    throw new Error(`MCP RPC 错误：${json.error?.message ?? `HTTP ${res.status}`}`)
  }
  return json.result
}

/** 发现 MCP Server 暴露的工具列表。 */
export async function listMcpTools(
  endpoint: string,
  authType: string,
  authConfig: AuthConfig,
): Promise<McpTool[]> {
  const result = await rpcPost(endpoint, authType, authConfig, 'tools/list', {}) as { tools?: McpTool[] }
  return result?.tools ?? []
}

/** 调用 MCP Server 上的工具。返回工具执行结果（文本内容）。 */
export async function callMcpTool(
  endpoint: string,
  authType: string,
  authConfig: AuthConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const result = await rpcPost(endpoint, authType, authConfig, 'tools/call', {
    name: toolName,
    arguments: args,
  }) as McpToolResult
  if (result?.isError) {
    const msg = result.content.find((c) => c.type === 'text')?.text ?? '工具执行失败'
    throw new Error(msg)
  }
  return result?.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n') ?? ''
}
