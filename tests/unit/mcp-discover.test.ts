/**
 * L2/L3 测试 · ADR-024 MCP tools 动态发现
 *
 * 规范：客户端不预注册 tools，运行时 tools/list 拉取。此前平台维护了 164 条
 * 静态 Tool 副本，既无来源也跑不通（run.ts 没有 case 'mcp'）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { discoverMcpTools } from '@/lib/mcp/discover'

const okInit = { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'demo', version: '1.0' } } }
const okList = {
  jsonrpc: '2.0', id: 2,
  result: { tools: [
    { name: 'search', description: '搜索', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
    { name: 'fetch_page', description: '抓取网页', inputSchema: { type: 'object' } },
  ] },
}

/** 依次返回 initialize / tools/list 两个响应 */
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

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('SSRF 防护', () => {
  // 🔴 MCP 不能成为绕过内网限制的入口——endpoint 由用户填，等于任意 URL 输入
  it.each([
    ['http://localhost:3000/mcp', '本机'],
    ['http://127.0.0.1/mcp', '回环'],
    ['http://10.0.0.5/mcp', '内网 A 段'],
    ['http://192.168.1.1/mcp', '内网 C 段'],
    ['http://169.254.169.254/mcp', '云元数据'],
    ['http://172.16.0.1/mcp', '内网 B 段'],
    ['file:///etc/passwd', '非 http 协议'],
  ])('拒绝 %s（%s）', async (url) => {
    const r = await discoverMcpTools(url)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('blocked')
  })

  it('非法 URL 直接拒绝，不发请求', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const r = await discoverMcpTools('not-a-url')
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('正常发现', () => {
  it('握手后拉到 tools 清单', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tools.map((t) => t.name)).toEqual(['search', 'fetch_page'])
      expect(r.tools[0].inputSchema).toHaveProperty('properties')
      expect(r.serverInfo?.name).toBe('demo')
    }
  })

  // 🔴 SSE 传输的 Server 回的是 `event: message\ndata: {...}`，
  // 只认裸 JSON 会让一半 Server 报「协议错误」，而问题其实在我们的解析
  it('兼容 SSE 帧格式的响应', async () => {
    mockSeq([
      { body: `event: message\ndata: ${JSON.stringify(okInit)}\n\n` },
      { body: `event: message\ndata: ${JSON.stringify(okList)}\n\n` },
    ])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.tools).toHaveLength(2)
  })

  it('带上 initialize 返回的 mcp-session-id 再请求 tools/list', async () => {
    mockSeq([
      { body: JSON.stringify(okInit), headers: { 'mcp-session-id': 'sess-123' } },
      { body: JSON.stringify(okList) },
    ])
    await discoverMcpTools('https://mcp.example.com/mcp')
    const second = vi.mocked(fetch).mock.calls[1]
    expect((second[1] as RequestInit).headers).toMatchObject({ 'mcp-session-id': 'sess-123' })
  })

  it('无名字的工具被过滤掉', async () => {
    mockSeq([
      { body: JSON.stringify(okInit) },
      { body: JSON.stringify({ jsonrpc: '2.0', result: { tools: [{ name: '', description: 'x' }, { name: 'ok' }] } }) },
    ])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    if (r.ok) expect(r.tools.map((t) => t.name)).toEqual(['ok'])
  })
})

describe('失败路径要给出可行动的原因', () => {
  it.each([
    [401, 'auth_failed'],
    [403, 'auth_failed'],
    [500, 'protocol_error'],
  ])('HTTP %i → %s', async (status, code) => {
    mockSeq([{ status, body: '' }])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe(code)
  })

  it('认证失败的提示要点明检查 Key', async () => {
    mockSeq([{ status: 401, body: '' }])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    if (!r.ok) expect(r.message).toMatch(/API Key|OAuth/)
  })

  it('JSON-RPC error 字段被转成人话', async () => {
    mockSeq([
      { body: JSON.stringify(okInit) },
      { body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' } }) },
    ])
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Method not found')
  })

  it('网络异常 → unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.code).toBe('unreachable'); expect(r.message).toContain('ECONNREFUSED') }
  })

  it('超时提示要说明是服务器侧访问不通', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')))
    const r = await discoverMcpTools('https://mcp.example.com/mcp')
    if (!r.ok) expect(r.message).toContain('超时')
  })
})

describe('凭证传递', () => {
  it('带 secret 时以 Bearer 发送', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await discoverMcpTools('https://mcp.example.com/mcp', { authType: 'api_key', secret: 'sk-test' })
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')
  })

  it('无 secret 时不发 Authorization 头', async () => {
    mockSeq([{ body: JSON.stringify(okInit) }, { body: JSON.stringify(okList) }])
    await discoverMcpTools('https://mcp.example.com/mcp')
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
