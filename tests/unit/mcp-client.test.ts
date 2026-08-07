/**
 * L2 测试 · MCP 调用客户端（ADR-024）
 *
 * 🔴 这些用例钉死的是一组「让 Agent 调 MCP 必然失败」的真 bug：
 * lib/mcp/client.ts 与 lib/mcp/discover.ts 曾是两套独立实现，四处行为不一致。
 * MCP 页面（走 discover）能正常拉到工具清单，于是问题一直没暴露——
 * 而 Agent 对话（走 client）调同一个 Server 从来就没通过。
 *
 * 其中危害最大的是 endpoint 拼接：库里 8 个已配置端点有 7 个自带 /mcp 路径，
 * 再拼一次就是 /mcp/mcp。这类 bug 不写测试，下次重构还会长回来。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listMcpTools, callMcpTool } from '@/lib/mcp/client'

const okInit = { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'demo' } } }
const okList = {
  jsonrpc: '2.0', id: 2,
  result: { tools: [{ name: 'search', description: '搜索', inputSchema: { type: 'object' } }] },
}
const okCall = { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: '执行结果' }] } }

function mockSeq(responses: { status?: number; body: string; headers?: Record<string, string> }[]) {
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    const r = responses[Math.min(i++, responses.length - 1)]
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      text: async () => r.body,
    }
  }))
}

const urlOf = (callIndex: number) => String(vi.mocked(fetch).mock.calls[callIndex][0])
const bodyOf = (callIndex: number) =>
  JSON.parse((vi.mocked(fetch).mock.calls[callIndex][1] as RequestInit).body as string)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('endpoint 原样使用，绝不拼接路径', () => {
  // 🔴 这条是主 bug：拼接会把线上 7/8 的端点打偏
  it.each([
    ['https://mcp.notion.com/mcp', '已含 /mcp'],
    ['https://mcp.stripe.com', '无路径'],
    ['https://mcp.atlassian.com/v1/mcp/authv2', '自定义路径'],
    ['https://api.githubcopilot.com/mcp/', '带尾斜杠'],
  ])('%s（%s）请求地址与配置一致', async (endpoint) => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await listMcpTools(endpoint, 'none', {})
    // URL 规范化只允许发生在尾斜杠层面，路径本身必须原样
    expect(urlOf(0).replace(/\/$/, '')).toBe(endpoint.replace(/\/$/, ''))
    expect(urlOf(0)).not.toContain('/mcp/mcp')
  })
})

describe('协议握手', () => {
  it('先 initialize 再 tools/list', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await listMcpTools('https://mcp.example.com/mcp', 'none', {})
    expect(bodyOf(0).method).toBe('initialize')
    expect(bodyOf(1).method).toBe('tools/list')
  })

  it('先 initialize 再 tools/call，且参数按规范放 name/arguments', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okCall) }])
    await callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'search', { q: '关键词' })
    expect(bodyOf(0).method).toBe('initialize')
    expect(bodyOf(1)).toMatchObject({ method: 'tools/call', params: { name: 'search', arguments: { q: '关键词' } } })
  })

  it('带回 initialize 返回的 mcp-session-id', async () => {
    mockSeq([
      { body: JSON.stringify(okInit), headers: { 'mcp-session-id': 'sess-9' } },
      { body: JSON.stringify(okCall) },
    ])
    await callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'search', {})
    expect((vi.mocked(fetch).mock.calls[1][1] as RequestInit).headers).toMatchObject({ 'mcp-session-id': 'sess-9' })
  })
})

describe('SSE 帧兼容', () => {
  // 🔴 旧实现用 res.json()，遇到 SSE 传输的 Server 直接抛 JSON 解析错
  it('tools/list 解析 SSE 帧', async () => {
    mockSeq([
      { body: `event: message\ndata: ${JSON.stringify(okInit)}\n\n` },
      { body: `event: message\ndata: ${JSON.stringify(okList)}\n\n` },
    ])
    const tools = await listMcpTools('https://mcp.example.com/mcp', 'none', {})
    expect(tools.map((t) => t.name)).toEqual(['search'])
  })

  it('tools/call 解析 SSE 帧', async () => {
    mockSeq([
      { body: `data: ${JSON.stringify(okInit)}\n\n` },
      { body: `data: ${JSON.stringify(okCall)}\n\n` },
    ])
    await expect(callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'search', {})).resolves.toBe('执行结果')
  })
})

describe('SSRF 防护', () => {
  // 🔴 旧实现完全没有校验，而 endpoint 是用户填的任意 URL
  it.each([
    'http://localhost:3000/mcp',
    'http://169.254.169.254/mcp',
    'http://10.0.0.5/mcp',
    'file:///etc/passwd',
  ])('拒绝 %s 且不发出请求', async (bad) => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(callMcpTool(bad, 'none', {}, 'x', {})).rejects.toThrow(/内网|非法/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('凭证传递', () => {
  // 🔴 凭证只以明文 secret 传入，且只能来自 lib/data/credentials 的服务端解密。
  // 不再从 mcp_servers.auth_config（jsonb 明文列）取——那等于绕过整套加密存储。
  const authHeaderOf = (i: number) =>
    ((vi.mocked(fetch).mock.calls[i][1] as RequestInit).headers as Record<string, string>).Authorization

  it('带 secret 时以 Bearer 发送', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await listMcpTools('https://mcp.example.com/mcp', 'api_key', 'sk-live-1')
    expect(authHeaderOf(0)).toBe('Bearer sk-live-1')
  })

  it('tools/call 同样带上凭证', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okCall) }])
    await callMcpTool('https://mcp.example.com/mcp', 'api_key', 'sk-live-2', 'search', {})
    // 握手与调用两次请求都要带，否则会话在第二步被拒
    expect(authHeaderOf(0)).toBe('Bearer sk-live-2')
    expect(authHeaderOf(1)).toBe('Bearer sk-live-2')
  })

  it('未配凭证时不发 Authorization', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await listMcpTools('https://mcp.example.com/mcp', 'api_key', undefined)
    expect(authHeaderOf(0)).toBeUndefined()
  })
})

describe('失败要给出可行动的原因', () => {
  it('认证失败点明检查 Key', async () => {
    mockSeq([{ status: 401, body: '' }])
    await expect(listMcpTools('https://mcp.example.com/mcp', 'api_key', { api_key: 'bad' }))
      .rejects.toThrow(/API Key|OAuth/)
  })

  it('工具自身报错时透出原因，而非通用文案', async () => {
    mockSeq([
      { body: JSON.stringify(okInit) },
      { body: JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '发票号不存在' }], isError: true } }) },
    ])
    await expect(callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'verify', {}))
      .rejects.toThrow('发票号不存在')
  })

  it('JSON-RPC error 被转成人话', async () => {
    mockSeq([
      { body: JSON.stringify(okInit) },
      { body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' } }) },
    ])
    await expect(callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'x', {}))
      .rejects.toThrow(/Method not found/)
  })

  it('多段文本结果按行拼接', async () => {
    mockSeq([
      { body: JSON.stringify(okInit) },
      { body: JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '第一段' }, { type: 'image' }, { type: 'text', text: '第二段' }] } }) },
    ])
    await expect(callMcpTool('https://mcp.example.com/mcp', 'none', {}, 'x', {})).resolves.toBe('第一段\n第二段')
  })
})
