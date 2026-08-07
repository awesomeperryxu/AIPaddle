import 'server-only'

// MCP 调用客户端：供 Agent 对话做 Function Calling 时发现并执行工具。
//
// 🔴 2026-08-07 修正三处会让调用必然失败的实现分歧（ADR-024）：
//   ① endpoint 被拼接 `/mcp`——但库里存的就是完整地址，8 个已配置端点里
//      7 个自带 /mcp 路径，拼完变成 https://mcp.notion.com/mcp/mcp，必然 404。
//      各家形态本就不同（Stripe 无路径、Atlassian 是 /v1/mcp/authv2），
//      任何拼接都是猜。现在原样使用。
//   ② 没有 initialize 握手——多数 Server 会直接拒绝未握手的 tools/list。
//   ③ 用 res.json() 解析——SSE 传输的 Server 回的是 `data: {...}` 帧，直接抛错。
// 另补 SSRF 校验：endpoint 由用户填写，等同任意 URL 输入。
//
// 协议细节统一在 lib/mcp/transport.ts，与 lib/mcp/discover.ts 共用同一实现——
// 此前两套各写各的，正是上述分歧的来源。

import { openMcpSession } from './transport'
import { normalizeTools, type McpTool } from './discover'

export type { McpTool }

export type McpToolResult = {
  content: { type: string; text?: string }[]
  isError?: boolean
}

// 🔴 凭证以**明文 secret** 传入，且只能来自 lib/data/credentials 的服务端解密
// （credentials 表 AES-256-GCM，AC-15）。不再从 mcp_servers.auth_config 取——
// 那是 jsonb 明文列，把密钥放进去等于绕过整套加密存储。

/** 发现 MCP Server 暴露的工具列表。失败抛错，由调用方决定如何降级。 */
export async function listMcpTools(
  endpoint: string,
  authType: string,
  secret?: string,
): Promise<McpTool[]> {
  const session = await openMcpSession(endpoint, { authType, secret })
  if (!session.ok) throw new Error(`MCP 连接失败：${session.message}`)

  const listed = await session.call('tools/list')
  if (!listed.ok) throw new Error(`MCP 工具发现失败：${listed.message}`)

  return normalizeTools(listed.result.tools)
}

/** 调用 MCP Server 上的工具，返回文本结果。 */
export async function callMcpTool(
  endpoint: string,
  authType: string,
  secret: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const session = await openMcpSession(endpoint, { authType, secret })
  if (!session.ok) throw new Error(`MCP 连接失败：${session.message}`)

  const called = await session.call('tools/call', { name: toolName, arguments: args })
  if (!called.ok) throw new Error(`MCP 调用失败：${called.message}`)

  const result = called.result as unknown as McpToolResult
  const content = Array.isArray(result?.content) ? result.content : []

  // 🔴 isError 是工具**自身**报的执行失败（区别于协议层错误），
  // 内容里通常带着原因，要透出去而不是吞成一句通用文案。
  if (result?.isError) {
    const msg = content.find((c) => c.type === 'text')?.text ?? '工具执行失败'
    throw new Error(msg)
  }

  return content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
}
