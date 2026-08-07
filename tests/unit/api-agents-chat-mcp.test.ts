/**
 * L3 集成测试 · Agent 对话的 MCP 路径（ADR-024）
 *
 * 这条路径此前完全没有测试覆盖，而它恰恰藏着三个「不报错但不工作」的缺陷：
 *   ① MCP 返回的 inputSchema 直接透传给模型——缺 type 时部分模型会拒绝**整个**
 *      工具列表，表现是「工具没被调用」而非报错。Plugin Tool 那侧早就做了归一化，
 *      MCP 侧漏了，等于同一个坑只填了一半。
 *   ② Server 工具发现失败被空 catch 吞掉，观感是「Agent 就是不会用工具」，
 *      真因（地址没填 / Key 没配）完全不可见。
 *   ③ 全部 Server 都发现失败时静默降级成普通对话，用户无从知道工具没生效。
 *
 * 三个都不会让任何断言变红，只会让功能安静地不工作——所以必须显式钉住。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({ getAgentForChat: vi.fn() }))
vi.mock('@/lib/data/call-logs', () => ({ recordCall: vi.fn() }))
vi.mock('@/lib/ai', () => ({ chatWithUsage: vi.fn(), chatWithTools: vi.fn() }))
vi.mock('@/lib/data/quota', () => ({ enforceLlmQuota: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/lib/ai/resolve', () => ({
  resolveModelClient: vi.fn().mockResolvedValue({ baseURL: 'https://p/v1', apiKey: 'k', model: 'qwen-plus', source: 'platform' }),
}))
vi.mock('@/lib/data/agent-resources', () => ({ getAgentResources: vi.fn() }))
vi.mock('@/lib/tools/run', () => ({ listAgentTools: vi.fn().mockResolvedValue([]), runToolVersion: vi.fn() }))
vi.mock('@/lib/mcp/client', () => ({ listMcpTools: vi.fn(), callMcpTool: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { getAgentForChat } from '@/lib/data/agents'
import { chatWithTools } from '@/lib/ai'
import { getAgentResources } from '@/lib/data/agent-resources'
import { listMcpTools } from '@/lib/mcp/client'
import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/agents/[id]/chat/route'

const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'
const SERVER_ID = 'abc123-de45-6789-0000-111122223333'
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }

const agent = {
  id: ID, name: '票证核验专家', description: '核验发票',
  status: 'published' as const, model: 'qwen-plus', systemPrompt: '你是核验助手。',
}

/** mcp_servers 查询链：.from().select().in().eq().is() → { data } */
function stubServers(rows: unknown[]) {
  const chain = {
    select: () => chain, in: () => chain, eq: () => chain,
    is: () => Promise.resolve({ data: rows }),
  }
  vi.mocked(createClient).mockResolvedValue({ from: () => chain } as never)
}

const SERVER_ROW = {
  id: SERVER_ID, name: '发票查验 (汇联易 Helios)',
  endpoint: 'https://hlymcp.huilianyi.com:8443/mcp',
  auth_type: 'api_key', auth_config: { api_key: 'sk-x' },
}

function call() {
  return POST(
    new Request(`http://localhost/api/agents/${ID}/chat`, {
      method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: '核验这张发票' }] }),
    }),
    { params: Promise.resolve({ id: ID }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestContext).mockResolvedValue(userCtx)
  vi.mocked(getAgentForChat).mockResolvedValue(agent as never)
  vi.mocked(getAgentResources).mockResolvedValue({ toolIds: [], mcpServerIds: [SERVER_ID] } as never)
  vi.mocked(chatWithTools).mockResolvedValue({ content: '已核验', tokensIn: 10, tokensOut: 5, model: 'qwen-plus' } as never)
  stubServers([SERVER_ROW])
})

describe('MCP 工具 schema 归一化', () => {
  // 🔴 缺 type 的 schema 会让部分模型拒绝整个工具列表，且不报错
  it('inputSchema 缺 type 时补成 object', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      { name: 'verify', description: '核验', inputSchema: { properties: { no: { type: 'string' } } } },
    ] as never)

    await call()

    const tools = vi.mocked(chatWithTools).mock.calls[0][1]
    expect(tools[0].function.parameters).toMatchObject({
      type: 'object',
      properties: { no: { type: 'string' } },
    })
  })

  it('inputSchema 整个为空也能产出合法结构', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      { name: 'ping', description: '', inputSchema: {} },
    ] as never)

    await call()

    expect(vi.mocked(chatWithTools).mock.calls[0][1][0].function.parameters)
      .toEqual({ type: 'object', properties: {} })
  })

  it('保留 required 字段', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      { name: 'verify', description: '核验', inputSchema: { properties: { no: {} }, required: ['no'] } },
    ] as never)

    await call()

    expect(vi.mocked(chatWithTools).mock.calls[0][1][0].function.parameters)
      .toMatchObject({ required: ['no'] })
  })

  it('工具名带 Server 前缀，避免多 Server 同名工具互相覆盖', async () => {
    vi.mocked(listMcpTools).mockResolvedValue([
      { name: 'verify', description: '核验', inputSchema: {} },
    ] as never)

    await call()

    expect(vi.mocked(chatWithTools).mock.calls[0][1][0].function.name)
      .toBe(`${SERVER_ID.slice(0, 6)}__verify`)
  })
})

describe('MCP Server 不可用时要说清楚', () => {
  // 🔴 之前是空 catch + 静默降级，用户只会觉得「这 Agent 不会用工具」
  it('全部 Server 发现失败 → 502 且点明去哪儿配', async () => {
    vi.mocked(listMcpTools).mockRejectedValue(new Error('认证失败（HTTP 401），请检查 API Key 或 OAuth 授权'))

    const res = await call()
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.error.code).toBe('mcp_unavailable')
    // 要含：哪个 Server、为什么、去哪修
    expect(body.error.message).toContain('发票查验')
    expect(body.error.message).toContain('API Key')
    expect(body.error.message).toMatch(/Plugin\s*→\s*MCP/)
  })

  it('不再静默降级成普通对话', async () => {
    vi.mocked(listMcpTools).mockRejectedValue(new Error('连接超时'))
    const { chatWithUsage } = await import('@/lib/ai')

    await call()

    // 走普通 LLM 路径就意味着「工具悄悄没生效」——这正是要防的
    expect(chatWithUsage).not.toHaveBeenCalled()
  })

  it('部分 Server 失败不阻断，其余工具照常可用', async () => {
    const OTHER = { ...SERVER_ROW, id: 'ffffff-0000-0000-0000-000000000000', name: '知识库 (Notion)' }
    stubServers([SERVER_ROW, OTHER])
    vi.mocked(listMcpTools)
      .mockRejectedValueOnce(new Error('连接超时'))
      .mockResolvedValueOnce([{ name: 'search', description: '搜索', inputSchema: {} }] as never)

    const res = await call()

    expect(res.status).toBe(200)
    expect(vi.mocked(chatWithTools).mock.calls[0][1]).toHaveLength(1)
  })
})
