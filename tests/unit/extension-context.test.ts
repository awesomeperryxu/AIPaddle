/**
 * L2 测试 · V12-8.5/8.6 Extension 对外调用身份链路（ADR-020）
 * - signServiceUserToken：HS256 头部/载荷/过期/签名可验；缺密钥即抛（不静默降级）
 * - verifyApiKey：撤销/过期/软删/未绑 Extension/Extension 未发布 —— 逐条默认拒绝
 * - getExtensionContext：缺 Bearer / 租户停用 / 无机器用户 —— 各自的错误码
 * - hasScope：默认拒绝
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

const OLD_SECRET = process.env.SUPABASE_JWT_SECRET

// ── signServiceUserToken（真实实现）──
describe('signServiceUserToken', () => {
  beforeEach(() => { process.env.SUPABASE_JWT_SECRET = 'test-secret-abc' })

  it('签出可验签的 HS256 令牌，sub=机器用户、role=authenticated、5 分钟过期', async () => {
    const { signServiceUserToken } = await import('@/lib/auth/extension-token')
    const token = signServiceUserToken('user-123')
    const [h, p, sig] = token.split('.')

    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' })
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    expect(payload.sub).toBe('user-123')
    expect(payload.role).toBe('authenticated')
    expect(payload.aud).toBe('authenticated')
    expect(payload.exp - payload.iat).toBe(300)

    // 签名必须用密钥**原始字符串**（base64 解码后签发会被 PostgREST 拒为 PGRST301）
    const expected = createHmac('sha256', 'test-secret-abc').update(`${h}.${p}`).digest('base64url')
    expect(sig).toBe(expected)
  })

  it('缺 SUPABASE_JWT_SECRET 时抛错，不静默降级', async () => {
    delete process.env.SUPABASE_JWT_SECRET
    vi.resetModules()
    const { signServiceUserToken } = await import('@/lib/auth/extension-token')
    expect(() => signServiceUserToken('user-123')).toThrow(/SUPABASE_JWT_SECRET/)
    process.env.SUPABASE_JWT_SECRET = OLD_SECRET ?? 'test-secret-abc'
  })
})

// ── verifyApiKey（mock service 客户端）──
const maybeSingle = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    }),
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const okExtension = {
  id: 'ext-1', status: 'published', target_type: 'agent', target_id: 'agent-1',
  service_user_id: 'svc-1', deleted_at: null, rate_limit_per_min: 60,
}
const okRow = {
  id: 'key-1', org_id: 'org-1', extension_id: 'ext-1',
  scopes: ['chat'], allowed_origins: ['https://royalblack-hotel.com'],
  rate_limit_per_min: null, revoked_at: null, expires_at: null, deleted_at: null,
  extensions: okExtension,
}

describe('verifyApiKey：默认拒绝', () => {
  beforeEach(() => { maybeSingle.mockReset() })

  it('有效 Key 返回身份与治理配置', async () => {
    maybeSingle.mockResolvedValue({ data: okRow, error: null })
    const { verifyApiKey } = await import('@/lib/data/api-keys')
    const v = await verifyApiKey('ap_sk_live_valid')
    expect(v).toMatchObject({
      keyId: 'key-1', orgId: 'org-1', extensionId: 'ext-1',
      scopes: ['chat'], serviceUserId: 'svc-1', targetId: 'agent-1',
    })
    expect(v?.rateLimitPerMin).toBe(60) // Key 未覆盖 → 取 Extension 默认值
  })

  it.each([
    ['空 Key', () => ({ data: okRow, error: null }), ''],
    ['查不到', () => ({ data: null, error: null }), 'ap_sk_live_x'],
    ['已撤销', () => ({ data: { ...okRow, revoked_at: '2026-01-01T00:00:00Z' }, error: null }), 'ap_sk_live_x'],
    ['已软删', () => ({ data: { ...okRow, deleted_at: '2026-01-01T00:00:00Z' }, error: null }), 'ap_sk_live_x'],
    ['已过期', () => ({ data: { ...okRow, expires_at: '2020-01-01T00:00:00Z' }, error: null }), 'ap_sk_live_x'],
    ['未绑 Extension（4.8.6 通用 Key 不得走对外入口）',
      () => ({ data: { ...okRow, extension_id: null, extensions: null }, error: null }), 'ap_sk_live_x'],
    ['Extension 已软删',
      () => ({ data: { ...okRow, extensions: { ...okExtension, deleted_at: '2026-01-01T00:00:00Z' } }, error: null }), 'ap_sk_live_x'],
    ['Extension 未发布（草稿）',
      () => ({ data: { ...okRow, extensions: { ...okExtension, status: 'draft' } }, error: null }), 'ap_sk_live_x'],
    ['Extension 已下线（发布过 ≠ 永久可用）',
      () => ({ data: { ...okRow, extensions: { ...okExtension, status: 'offline' } }, error: null }), 'ap_sk_live_x'],
  ])('%s → 返回 null', async (_name, resp, key) => {
    maybeSingle.mockResolvedValue(resp())
    const { verifyApiKey } = await import('@/lib/data/api-keys')
    expect(await verifyApiKey(key)).toBeNull()
  })
})

// ── getExtensionContext ──
describe('getExtensionContext', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    process.env.SUPABASE_JWT_SECRET = 'test-secret-abc'
  })
  const req = (headers: Record<string, string> = {}) => new Request('https://x/api/ext/v1/chat', { headers })

  it('没带 Authorization → missing_key', async () => {
    const { getExtensionContext } = await import('@/lib/auth/extension-context')
    expect(await getExtensionContext(req())).toEqual({ ok: false, error: 'missing_key' })
  })

  it('Key 无效 → invalid_key', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const { getExtensionContext } = await import('@/lib/auth/extension-context')
    const r = await getExtensionContext(req({ authorization: 'Bearer bad' }))
    expect(r).toEqual({ ok: false, error: 'invalid_key' })
  })

  it('hasScope 默认拒绝：未声明的 scope 一律 false', async () => {
    const { hasScope } = await import('@/lib/auth/extension-context')
    const ctx = { scopes: ['chat'] } as Parameters<typeof hasScope>[0]
    expect(hasScope(ctx, 'chat')).toBe(true)
    expect(hasScope(ctx, 'leads')).toBe(false)
    expect(hasScope(ctx, 'handoff')).toBe(false)
  })
})
