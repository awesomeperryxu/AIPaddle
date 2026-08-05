/**
 * L2/L3 测试 · 4.8.6 对外 API Key
 * - 纯函数：generateApiKey 格式/前缀/哈希 · hashApiKey 确定性
 * - 路由：GET/POST/DELETE 权限门控(apikey:manage=Admin) · POST 一次性返回明文 · 审计
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// ── 纯函数（真实实现）──
import { generateApiKey, hashApiKey } from '@/lib/data/api-keys'

describe('API Key 生成/哈希（纯函数）', () => {
  it('generateApiKey：格式 ap_sk_live_<40hex> + 前缀15位 + 哈希匹配', () => {
    const rand = (n: number) => Buffer.alloc(n, 0xab) // 确定性：全 0xab
    const { plaintext, hash, prefix } = generateApiKey(rand)
    expect(plaintext).toMatch(/^ap_sk_live_[0-9a-f]{40}$/)
    expect(prefix).toBe(plaintext.slice(0, 15))
    expect(hash).toBe(hashApiKey(plaintext))
    expect(hash).toHaveLength(64) // sha256 hex
  })
  it('hashApiKey 确定性且不等于明文', () => {
    expect(hashApiKey('ap_sk_live_x')).toBe(hashApiKey('ap_sk_live_x'))
    expect(hashApiKey('ap_sk_live_x')).not.toContain('ap_sk_live_x')
  })
})

// ── 路由（mock 数据层）──
vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/api-keys', async (orig) => {
  const real = await orig<typeof import('@/lib/data/api-keys')>()
  return {
    ...real, // 保留 API_KEY_SCOPES 等纯导出
    listApiKeys: vi.fn(),
    listApiKeysWithExtension: vi.fn(),
    createApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
  }
})
// Key-1：GET 现在还要取租户名做页头标注，不 mock 会真去连 Supabase
vi.mock('@/lib/data/tenant', () => ({ getTenantName: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/keys/route'
import { DELETE } from '@/app/api/keys/[id]/route'
import { listApiKeysWithExtension, createApiKey, revokeApiKey } from '@/lib/data/api-keys'
import { getTenantName } from '@/lib/data/tenant'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listApiKeysWithExtension)
const mockTenantName = vi.mocked(getTenantName)
const mockCreate = vi.mocked(createApiKey)
const mockRevoke = vi.mocked(revokeApiKey)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }
const masked = {
  id: 'k1', name: 'CRM', keyPrefix: 'ap_sk_live_a1f3********', scope: 'agent' as const,
  status: 'active' as const, lastUsedAt: null, createdAt: '2026-07-27',
  extensionId: null, scopes: ['chat'], expiresAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([{ ...masked, extensionName: null }])
  mockTenantName.mockResolvedValue('测试租户')
  mockCreate.mockResolvedValue({ key: 'ap_sk_live_PLAINTEXT_ONCE', masked })
  mockRevoke.mockResolvedValue(true)
})

const postReq = (b: unknown) => new Request('http://localhost/api/keys', { method: 'POST', body: JSON.stringify(b) })
const idParams = (id = 'k1') => ({ params: Promise.resolve({ id }) })

describe('GET /api/keys', () => {
  it('401 未登录', async () => { mockCtx.mockResolvedValue(null); expect((await GET()).status).toBe(401) })
  it('403 非 Admin 不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await GET()).status).toBe(403); expect(mockList).not.toHaveBeenCalled()
  })
  it('200 返回脱敏清单(无明文/哈希)', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const body = await (await GET()).json()
    expect(body.keys[0].keyPrefix).toContain('****')
    expect(JSON.stringify(body)).not.toMatch(/PLAINTEXT|key_hash/)
  })
  // Key-1：归属信息必须回给前端，否则页面无法区分「通用 Key」与「某扩展的 Key」
  it('200 带回租户名与所属扩展，区分通用/绑定两类 Key', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    mockList.mockResolvedValue([
      { ...masked, extensionName: null },
      { ...masked, id: 'k2', extensionId: 'e1', extensionName: '官网在线咨询' },
    ])
    const body = await (await GET()).json()
    expect(body.orgName).toBe('测试租户')
    expect(body.keys[0].extensionId).toBeNull()          // 租户通用
    expect(body.keys[1].extensionName).toBe('官网在线咨询') // 绑定扩展
  })
})

describe('POST /api/keys', () => {
  it('403 非 Admin', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await POST(postReq({ name: 'x' }))).status).toBe(403); expect(mockCreate).not.toHaveBeenCalled()
  })
  it('400 名称为空', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await POST(postReq({ name: '  ' }))).status).toBe(400)
  })
  it('201 签发返回明文一次 + 非法 scope 兜底 agent', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    const res = await POST(postReq({ name: 'CRM', scope: 'wat' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.key).toBe('ap_sk_live_PLAINTEXT_ONCE')
    expect(mockCreate).toHaveBeenCalledWith(adminCtx, { name: 'CRM', scope: 'agent' })
  })
})

describe('DELETE /api/keys/[id]', () => {
  it('403 非 Admin', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await DELETE(new Request('http://localhost/api/keys/k1', { method: 'DELETE' }), idParams())).status).toBe(403)
    expect(mockRevoke).not.toHaveBeenCalled()
  })
  it('404 已吊销/不存在', async () => {
    mockCtx.mockResolvedValue(adminCtx); mockRevoke.mockResolvedValue(false)
    expect((await DELETE(new Request('http://localhost/api/keys/k1', { method: 'DELETE' }), idParams())).status).toBe(404)
  })
  it('200 吊销成功', async () => {
    mockCtx.mockResolvedValue(adminCtx)
    expect((await DELETE(new Request('http://localhost/api/keys/k1', { method: 'DELETE' }), idParams())).status).toBe(200)
    expect(mockRevoke).toHaveBeenCalledWith(adminCtx, 'k1')
  })
})
