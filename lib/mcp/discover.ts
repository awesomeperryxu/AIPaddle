import 'server-only'

// MCP tools 动态发现（ADR-024）。
//
// 规范：客户端不预注册 tools，运行时通过 `tools/list` 向 Server 拉取；
// Server 可通过 notifications/tools/list_changed 通知变更。
// 因此平台不落静态 tools 副本——那份副本从产生的那一刻就在过期。
//
// 🔴 协议细节（SSRF 校验 / initialize 握手 / 会话 id / SSE 帧解析）统一在
// lib/mcp/transport.ts。此前本文件与 lib/mcp/client.ts 各写一套，四处行为不一致，
// 导致「MCP 页拉得到工具、Agent 调不通同一个 Server」。见 transport.ts 顶部说明。

import { openMcpSession, type McpAuth } from './transport'

export type McpTool = {
  name: string
  description: string
  /** JSON Schema，供 Function Calling 使用 */
  inputSchema: Record<string, unknown>
}

export type DiscoverResult =
  | { ok: true; tools: McpTool[]; serverInfo?: { name?: string; version?: string } }
  | { ok: false; code: 'unreachable' | 'auth_failed' | 'protocol_error' | 'blocked'; message: string }

/** 把 Server 返回的原始 tools 规整成内部结构，丢掉没有名字的（无法调用）。 */
export function normalizeTools(raw: unknown): McpTool[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => {
      const tt = t as Record<string, unknown>
      return {
        name: String(tt.name ?? ''),
        description: String(tt.description ?? ''),
        inputSchema: (tt.inputSchema ?? tt.input_schema ?? {}) as Record<string, unknown>,
      }
    })
    .filter((t) => t.name)
}

/**
 * 连接 MCP Server 并拉取其 tools 清单。
 *
 * 失败一律返回结构化原因而非抛错——调用方要把「连不上」如实展示给用户，
 * 而不是让整个页面 500。
 */
export async function discoverMcpTools(
  endpoint: string,
  opts: McpAuth & { timeoutMs?: number } = {},
): Promise<DiscoverResult> {
  const session = await openMcpSession(endpoint, opts, opts.timeoutMs)
  if (!session.ok) return { ok: false, code: session.code, message: session.message }

  const listed = await session.call('tools/list')
  if (!listed.ok) return { ok: false, code: listed.code, message: listed.message }

  const raw = listed.result.tools
  if (!Array.isArray(raw)) {
    return { ok: false, code: 'protocol_error', message: '响应中缺少 tools 列表' }
  }

  return { ok: true, tools: normalizeTools(raw), serverInfo: session.serverInfo }
}
