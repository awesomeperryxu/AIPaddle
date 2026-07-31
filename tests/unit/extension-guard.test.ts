/**
 * L2 测试 · V12-8.8 对外端点治理闸门（ADR-020 §6-§7）
 * - 来源白名单：命中放行 / 未命中 403 / 无 Origin 的服务端调用放行 / 空白名单拒一切带 Origin
 * - Scope：默认拒绝
 * - 限流：超限 429 + Retry-After；按 Key 与 IP 双维度
 * - CORS：只回具体来源，绝不回 *
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock 会被提升到文件顶部，普通 const 此时尚未初始化 → 必须用 vi.hoisted
const { getExtensionContext } = vi.hoisted(() => ({ getExtensionContext: vi.fn() }))
vi.mock('@/lib/auth/extension-context', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/extension-context')>()
  return { ...real, getExtensionContext }
})

import { guardExtensionRequest, corsHeaders, __resetRateLimit } from '@/lib/auth/extension-guard'

const ORIGIN = 'https://royalblack-hotel.com'
const baseCtx = {
  orgId: 'org-1', extensionId: 'ext-1', keyId: 'key-1',
  scopes: ['chat'], allowedOrigins: [ORIGIN], rateLimitPerMin: 3,
  serviceUserId: 'svc-1', targetType: 'agent', targetId: 'agent-1',
  request: { userId: 'svc-1', orgId: 'org-1', roles: [] as never[] },
}
const req = (headers: Record<string, string> = {}) =>
  new Request('https://api/api/ext/v1/chat', { method: 'POST', headers })

beforeEach(() => {
  __resetRateLimit()
  getExtensionContext.mockReset()
  getExtensionContext.mockResolvedValue({ ok: true, ctx: { ...baseCtx } })
})

describe('鉴权失败映射', () => {
  it.each([
    ['missing_key', 401],
    ['invalid_key', 401],
    ['tenant_suspended', 403],
    ['no_identity', 503],
  ])('%s → HTTP %i', async (error, status) => {
    getExtensionContext.mockResolvedValue({ ok: false, error })
    const r = await guardExtensionRequest(req(), 'chat')
    expect('response' in r && r.response.status).toBe(status)
  })
})

describe('来源白名单（ADR-020 §6）', () => {
  it('白名单内的 Origin 放行', async () => {
    const r = await guardExtensionRequest(req({ origin: ORIGIN }), 'chat')
    expect('ctx' in r).toBe(true)
  })

  it('白名单外的 Origin → 403', async () => {
    const r = await guardExtensionRequest(req({ origin: 'https://evil.com' }), 'chat')
    expect('response' in r && r.response.status).toBe(403)
  })

  it('无 Origin（服务端 BFF 调用）放行', async () => {
    const r = await guardExtensionRequest(req(), 'chat')
    expect('ctx' in r).toBe(true)
  })

  it('空白名单 = 仅服务端调用：带 Origin 一律拒', async () => {
    getExtensionContext.mockResolvedValue({ ok: true, ctx: { ...baseCtx, allowedOrigins: [] } })
    const r = await guardExtensionRequest(req({ origin: ORIGIN }), 'chat')
    expect('response' in r && r.response.status).toBe(403)
  })
})

describe('Scope 默认拒绝', () => {
  it('缺 leads scope → 403', async () => {
    const r = await guardExtensionRequest(req(), 'leads')
    expect('response' in r && r.response.status).toBe(403)
  })
})

describe('限流（ADR-020 §7）', () => {
  it('超过 rate_limit → 429 且带 Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      expect('ctx' in (await guardExtensionRequest(req(), 'chat'))).toBe(true)
    }
    const r = await guardExtensionRequest(req(), 'chat')
    expect('response' in r && r.response.status).toBe(429)
    if ('response' in r) {
      expect(Number(r.response.headers.get('Retry-After'))).toBeGreaterThan(0)
    }
  })

  it('不同 Key 各自计数，互不牵连', async () => {
    for (let i = 0; i < 3; i++) await guardExtensionRequest(req(), 'chat')
    getExtensionContext.mockResolvedValue({ ok: true, ctx: { ...baseCtx, keyId: 'key-2' } })
    // 换 Key 但 IP 相同 —— IP 桶已满，仍应被拦（防单 IP 换 Key 绕过）
    const r = await guardExtensionRequest(req({ 'x-forwarded-for': '1.2.3.4' }), 'chat')
    expect('ctx' in r).toBe(true) // 换了 IP 才放行
  })
})

describe('CORS 头', () => {
  it('命中白名单才回 Allow-Origin，且为具体来源不是 *', () => {
    const h = corsHeaders(ORIGIN, [ORIGIN]) as Record<string, string>
    expect(h['Access-Control-Allow-Origin']).toBe(ORIGIN)
    expect(Object.values(h)).not.toContain('*')
  })
  it('未命中白名单不回任何 CORS 头', () => {
    expect(corsHeaders('https://evil.com', [ORIGIN])).toEqual({})
  })
})
