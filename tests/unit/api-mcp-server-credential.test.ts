/**
 * L3 集成测试 · MCP Server 凭证链路（0039 / ADR-024 收尾）
 *
 * 背景：2026-08-07 从生产服务器实测 8 个已配置的真实端点
 * （GitHub / Notion / Linear / Stripe / Sentry / Cloudflare / Atlassian / 汇联易），
 * **全部返回 HTTP 401**——官方远程 MCP 几乎都强制鉴权，匿名 tools/list 一律拒绝。
 * 也就是说没有凭证这一环，「点开 Server 看 tools」一个都点不开。
 *
 * 🔴 本文件重点钉两件事：
 *   ① tools 路由**确实把凭证传下去了**。此前它写死匿名尝试（理由是「credentials 表为空」），
 *      那个临时假设一直没回填，配了凭证也用不上——这类「参数没传」的缺陷不会报错，
 *      只会让功能安静地失效。
 *   ② 密钥**只走加密引用**。PATCH 只接受 credentialId，绝不接受明文 secret 落到
 *      mcp_servers 表（0002 的 auth_config 是 jsonb 明文列，塞进去等于绕过 AC-15 整套加密）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/mcp-servers', () => ({
  getMcpServerById: vi.fn(), updateMcpServer: vi.fn(), deleteMcpServer: vi.fn(),
}))
vi.mock('@/lib/data/credentials', () => ({ getCredentialPlaintext: vi.fn() }))
vi.mock('@/lib/mcp/discover', () => ({ discoverMcpTools: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { getMcpServerById, updateMcpServer } from '@/lib/data/mcp-servers'
import { getCredentialPlaintext } from '@/lib/data/credentials'
import { discoverMcpTools } from '@/lib/mcp/discover'
import { GET as getTools } from '@/app/api/mcp-servers/[id]/tools/route'
import { PATCH } from '@/app/api/mcp-servers/[id]/route'

const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'
const CRED_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

const server = {
  id: ID, name: '知识库 (Notion)', description: '', type: 'third_party',
  endpoint: 'https://mcp.notion.com/mcp', authType: 'api_key',
  credentialId: null as string | null,
  scope: '', status: 'approved', securityLevel: 'medium',
  allowedRoles: ['Admin'], allowedDepartments: [], createdAt: '', updatedAt: '',
}

const toolsReq = () => getTools(new Request('http://localhost/x'), { params: Promise.resolve({ id: ID }) })
const patchReq = (body: unknown) =>
  PATCH(new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: ID }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestContext).mockResolvedValue(adminCtx)
  vi.mocked(discoverMcpTools).mockResolvedValue({ ok: true, tools: [], serverInfo: {} })
  vi.mocked(updateMcpServer).mockResolvedValue(server as never)
})

describe('tools 路由必须把凭证传下去', () => {
  it('已绑凭证 → 解密后作为 secret 传入', async () => {
    vi.mocked(getMcpServerById).mockResolvedValue({ ...server, credentialId: CRED_ID } as never)
    vi.mocked(getCredentialPlaintext).mockResolvedValue('secret-token-xyz')

    await toolsReq()

    expect(getCredentialPlaintext).toHaveBeenCalledWith(adminCtx, CRED_ID)
    expect(discoverMcpTools).toHaveBeenCalledWith(
      'https://mcp.notion.com/mcp',
      expect.objectContaining({ secret: 'secret-token-xyz' }),
    )
  })

  it('未绑凭证 → 不解密，且不伪造 secret', async () => {
    vi.mocked(getMcpServerById).mockResolvedValue(server as never)

    await toolsReq()

    expect(getCredentialPlaintext).not.toHaveBeenCalled()
    expect(discoverMcpTools).toHaveBeenCalledWith(
      'https://mcp.notion.com/mcp',
      expect.objectContaining({ secret: undefined }),
    )
  })

  it('凭证明文绝不出现在响应里', async () => {
    vi.mocked(getMcpServerById).mockResolvedValue({ ...server, credentialId: CRED_ID } as never)
    vi.mocked(getCredentialPlaintext).mockResolvedValue('secret-token-xyz')

    const body = await (await toolsReq()).text()

    expect(body).not.toContain('secret-token-xyz')
  })
})

describe('401 且未配凭证时要指出去哪儿配', () => {
  it('给出 needsCredential 与可行动的提示', async () => {
    vi.mocked(getMcpServerById).mockResolvedValue(server as never)
    vi.mocked(discoverMcpTools).mockResolvedValue({
      ok: false, code: 'auth_failed', message: '认证失败（HTTP 401），请检查 API Key 或 OAuth 授权',
    })

    const body = await (await toolsReq()).json()

    expect(body.needsCredential).toBe(true)
    expect(body.message).toContain('配置凭证')
  })

  it('已配凭证仍 401 → 不提示「未绑定凭证」，避免误导', async () => {
    vi.mocked(getMcpServerById).mockResolvedValue({ ...server, credentialId: CRED_ID } as never)
    vi.mocked(getCredentialPlaintext).mockResolvedValue('wrong-key')
    vi.mocked(discoverMcpTools).mockResolvedValue({
      ok: false, code: 'auth_failed', message: '认证失败（HTTP 401），请检查 API Key 或 OAuth 授权',
    })

    const body = await (await toolsReq()).json()

    expect(body.needsCredential).toBe(false)
    expect(body.message).not.toContain('尚未绑定凭证')
  })
})

describe('PATCH 只接受凭证引用，不接受明文', () => {
  // 🔴 mcp_servers 没有加密列。任何形式的密钥落到这张表都是明文泄露。
  it.each(['secret', 'apiKey', 'api_key', 'authConfig', 'token'])(
    '忽略请求体里的 %s 字段', async (field) => {
      await patchReq({ [field]: 'sk-should-not-be-saved' })

      const patch = vi.mocked(updateMcpServer).mock.calls[0][2]
      expect(JSON.stringify(patch)).not.toContain('sk-should-not-be-saved')
    })

  it('接受 credentialId 引用', async () => {
    await patchReq({ credentialId: CRED_ID })
    expect(vi.mocked(updateMcpServer).mock.calls[0][2]).toMatchObject({ credentialId: CRED_ID })
  })

  it('credentialId: null 表示解绑，必须传下去', async () => {
    await patchReq({ credentialId: null })
    // 🔴 若数据层用真值判定（if (patch.credentialId)），解绑会被静默忽略
    expect(vi.mocked(updateMcpServer).mock.calls[0][2]).toHaveProperty('credentialId', null)
  })

  it('不传 credentialId 时不改动绑定', async () => {
    await patchReq({ name: '改个名' })
    expect(vi.mocked(updateMcpServer).mock.calls[0][2]).not.toHaveProperty('credentialId')
  })

  it('authType 只接受白名单值', async () => {
    await patchReq({ authType: 'evil' })
    expect(vi.mocked(updateMcpServer).mock.calls[0][2]).not.toHaveProperty('authType')
  })
})
