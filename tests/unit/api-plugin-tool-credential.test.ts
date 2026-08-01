/**
 * L3 集成测试 · Plugin / Tool / Credential API 的门控与响应契约（V12-2.7）
 *
 * 守卫契约测试只查「有没有鉴权入口」，查不出「权限给对没有」。这里补上：
 * 每个端点逐一验证未登录 / 越权 / 正常三态，外加最要紧的一条——
 * **凭证明文绝不出现在任何响应或审计中**。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/plugins', async (orig) => {
  const actual = await orig<typeof import('@/lib/data/plugins')>()
  return {
    ...actual,                       // 保留 PluginValidationError 等真实导出
    listPlugins: vi.fn(), createPlugin: vi.fn(),
    getPluginById: vi.fn(), updatePlugin: vi.fn(), deletePlugin: vi.fn(),
    transitionPlugin: vi.fn(),
  }
})
vi.mock('@/lib/data/credentials', async (orig) => {
  const actual = await orig<typeof import('@/lib/data/credentials')>()
  return { ...actual, listCredentials: vi.fn(), createCredential: vi.fn() }
})

import { getRequestContext } from '@/lib/context'
import { writeAudit } from '@/lib/data/audit'
import { listPlugins, createPlugin, deletePlugin } from '@/lib/data/plugins'
import { listCredentials, createCredential } from '@/lib/data/credentials'
import { GET as pluginsGET, POST as pluginsPOST } from '@/app/api/plugins/route'
import { DELETE as pluginDELETE } from '@/app/api/plugins/[id]/route'
import { GET as credGET, POST as credPOST } from '@/app/api/credentials/route'

const mockCtx = vi.mocked(getRequestContext)
const mockAudit = vi.mocked(writeAudit)

const admin: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const developer: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
const user: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }
const auditor: RequestContext = { userId: 'u4', orgId: 'org1', roles: ['Auditor'] }

const req = (body?: unknown) =>
  new Request('http://x/api/x', body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
const params = (id = '11111111-1111-1111-1111-111111111111') => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(admin)
})

describe('GET /api/plugins', () => {
  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await pluginsGET(req())).status).toBe(401)
  })

  it('读放开给全角色（RLS 兜租户隔离）', async () => {
    vi.mocked(listPlugins).mockResolvedValue([])
    for (const c of [admin, developer, user, auditor]) {
      mockCtx.mockResolvedValueOnce(c)
      expect((await pluginsGET(req())).status, `${c.roles[0]} 应可读`).toBe(200)
    }
  })
})

describe('POST /api/plugins', () => {
  it('🔴 User 角色 → 403，且不触数据层', async () => {
    mockCtx.mockResolvedValueOnce(user)
    expect((await pluginsPOST(req({ name: 'x', providerType: 'mcp' }))).status).toBe(403)
    expect(createPlugin).not.toHaveBeenCalled()
  })

  it('🔴 Auditor 只能审核不能创建 → 403', async () => {
    mockCtx.mockResolvedValueOnce(auditor)
    expect((await pluginsPOST(req({ name: 'x', providerType: 'mcp' }))).status).toBe(403)
  })

  it('Developer 可创建 → 201 且留痕', async () => {
    mockCtx.mockResolvedValueOnce(developer)
    vi.mocked(createPlugin).mockResolvedValueOnce({
      id: 'p1', name: 'GitHub', description: '', providerType: 'mcp',
      repo: null, license: null, docsUrl: null, stars: null,
      status: 'draft', origin: 'user', mandatory: false, createdAt: '2026-08-01',
    })
    const res = await pluginsPOST(req({ name: 'GitHub', providerType: 'mcp' }))
    expect(res.status).toBe(201)
    expect(mockAudit).toHaveBeenCalledWith(developer, 'plugin.created', 'plugin', 'p1', expect.anything())
  })

  it('🔴 providerType=workflow → 400（D-06 在 API 层也拦）', async () => {
    // 不 mock createPlugin，让真实的 assertProviderType 抛错
    vi.mocked(createPlugin).mockImplementationOnce(async (...args) => {
      const real = await vi.importActual<typeof import('@/lib/data/plugins')>('@/lib/data/plugins')
      return real.createPlugin(...(args as Parameters<typeof real.createPlugin>))
    })
    const res = await pluginsPOST(req({ name: 'x', providerType: 'workflow' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/plugins/[id]', () => {
  it('🔴 已发布 → 409 且提示先下线（不是 404——资源存在）', async () => {
    vi.mocked(deletePlugin).mockResolvedValueOnce('published')
    const res = await pluginDELETE(req(), params())
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toMatch(/先下线/)
  })

  it('🔴 仍有 Tool → 409 且说明要先处理 Tool', async () => {
    vi.mocked(deletePlugin).mockResolvedValueOnce('has_tools')
    const res = await pluginDELETE(req(), params())
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toMatch(/Tool/)
  })

  it('不存在 → 404', async () => {
    vi.mocked(deletePlugin).mockResolvedValueOnce('not_found')
    expect((await pluginDELETE(req(), params())).status).toBe(404)
  })
})

describe('Credential API —— 最高敏感资产', () => {
  it('🔴 User 与 Auditor 均不可读凭证列表 → 403', async () => {
    for (const c of [user, auditor]) {
      mockCtx.mockResolvedValueOnce(c)
      expect((await credGET(req())).status, `${c.roles[0]} 不应能读凭证`).toBe(403)
    }
    expect(listCredentials).not.toHaveBeenCalled()
  })

  it('Admin / Developer 可读', async () => {
    vi.mocked(listCredentials).mockResolvedValue([])
    for (const c of [admin, developer]) {
      mockCtx.mockResolvedValueOnce(c)
      expect((await credGET(req())).status).toBe(200)
    }
  })

  it('🔴 创建响应体绝不含明文', async () => {
    vi.mocked(createCredential).mockResolvedValueOnce({
      id: 'c1', name: 'SMTP-生产', description: '', kind: 'smtp',
      secretMasked: 'pas****word', meta: { host: 'smtp.x.com' },
      expiresAt: null, enabled: true, createdAt: '2026-08-01',
    })
    const res = await credPOST(req({ name: 'SMTP-生产', kind: 'smtp', secret: 'super-secret-pw' }))
    expect(res.status).toBe(201)
    const text = JSON.stringify(await res.json())
    expect(text, '响应中不得出现明文').not.toContain('super-secret-pw')
    expect(text).toContain('pas****word')   // 只回脱敏值
  })

  it('🔴 审计 detail 绝不含明文，只记名称与类型', async () => {
    vi.mocked(createCredential).mockResolvedValueOnce({
      id: 'c1', name: 'SMTP-生产', description: '', kind: 'smtp',
      secretMasked: '****', meta: {}, expiresAt: null, enabled: true, createdAt: '2026-08-01',
    })
    await credPOST(req({ name: 'SMTP-生产', kind: 'smtp', secret: 'super-secret-pw' }))
    const detail = JSON.stringify(mockAudit.mock.calls[0]?.[4] ?? {})
    expect(detail).not.toContain('super-secret-pw')
    expect(detail).toContain('SMTP-生产')
  })

  it('未登录 → 401，且不触数据层', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await credPOST(req({ name: 'x' }))).status).toBe(401)
    expect(createCredential).not.toHaveBeenCalled()
  })
})
