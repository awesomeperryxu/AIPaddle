import { describe, it, expect, vi, beforeEach } from 'vitest'

import { blockedIpReason, assertOutboundAllowed, guardedFetch, NetGuardError } from './net-guard'

// 解析器以参数注入，测试里给个假的即可 —— 不 mock node:dns，
// 否则测试会真的走本机 DNS（本机开着 fake-ip 代理时全部解析到 198.18.x，
// 结果是测试红得莫名其妙）
let resolved = '93.184.216.34'
const resolver = async () => resolved
const failing = async () => { throw new Error('ENOTFOUND') }
const resolvesTo = (ip: string) => { resolved = ip }

beforeEach(() => { vi.clearAllMocks(); resolvesTo('93.184.216.34') })

describe('blockedIpReason', () => {
  it('拦住本机回环', () => {
    expect(blockedIpReason('127.0.0.1')).toMatch(/回环/)
    expect(blockedIpReason('127.255.255.254')).toMatch(/回环/)
    expect(blockedIpReason('::1')).toMatch(/回环/)
  })

  it('🔴 拦住云元数据端点 169.254.169.254', () => {
    // SSRF 最常见的目标：读到临时密钥就等于拿到整个云账号
    expect(blockedIpReason('169.254.169.254')).toMatch(/链路本地|元数据/)
    expect(blockedIpReason('169.254.0.23')).toMatch(/链路本地|元数据/)
  })

  it('拦住各私有网段', () => {
    for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1']) {
      expect(blockedIpReason(ip), ip).not.toBeNull()
    }
  })

  it('🔴 IPv4-mapped IPv6 按内嵌 v4 判断，不能绕过', () => {
    // ::ffff:127.0.0.1 若只按 IPv6 规则看会被放行
    expect(blockedIpReason('::ffff:127.0.0.1')).toMatch(/回环/)
    expect(blockedIpReason('::ffff:169.254.169.254')).not.toBeNull()
    expect(blockedIpReason('::ffff:10.0.0.1')).not.toBeNull()
  })

  it('拦住 IPv6 私有与链路本地', () => {
    expect(blockedIpReason('fc00::1')).not.toBeNull()
    expect(blockedIpReason('fd12:3456::1')).not.toBeNull()
    expect(blockedIpReason('fe80::1')).not.toBeNull()
  })

  it('放行正常公网地址', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '2606:2800:220:1::1']) {
      expect(blockedIpReason(ip), ip).toBeNull()
    }
  })

  it('172.15/172.32 不在私有段内，不应误拦', () => {
    // 私有段是 172.16.0.0/12（16~31），边界外的要放行
    expect(blockedIpReason('172.15.0.1')).toBeNull()
    expect(blockedIpReason('172.32.0.1')).toBeNull()
  })
})

describe('assertOutboundAllowed', () => {
  it('放行白名单内且解析正常的域名', async () => {
    await expect(assertOutboundAllowed('https://api.example.com/x', ['api.example.com'], resolver))
      .resolves.toMatchObject({ host: 'api.example.com' })
  })

  it('拒绝 http', async () => {
    await expect(assertOutboundAllowed('http://api.example.com/x', ['api.example.com'], resolver))
      .rejects.toThrow(/https/)
  })

  it('拒绝不在白名单的域名', async () => {
    await expect(assertOutboundAllowed('https://evil.com/x', ['api.example.com'], resolver))
      .rejects.toThrow(/不在白名单/)
  })

  it('白名单为空一律拒绝', async () => {
    await expect(assertOutboundAllowed('https://api.example.com/x', [], resolver))
      .rejects.toThrow(/未配置域名白名单/)
  })

  it('🔴 白名单内的域名解析到内网也要拒（DNS rebinding）', async () => {
    // 配置期校验只看域名字符串，这一步才是真正拦住 rebinding 的地方
    resolvesTo('127.0.0.1')
    await expect(assertOutboundAllowed('https://api.example.com/x', ['api.example.com'], resolver))
      .rejects.toThrow(/解析到.*地址/)

    resolvesTo('169.254.169.254')
    await expect(assertOutboundAllowed('https://api.example.com/x', ['api.example.com'], resolver))
      .rejects.toThrow(/解析到/)
  })

  it('解析失败时拒绝而不是放行', async () => {
    await expect(assertOutboundAllowed('https://api.example.com/x', ['api.example.com'], failing))
      .rejects.toThrow(/解析失败/)
  })
})

describe('guardedFetch', () => {
  const okRes = () => new Response('{"ok":true}', { status: 200 })

  it('正常请求透传响应', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okRes()))
    const r = await guardedFetch('https://api.example.com/x', ['api.example.com'], { timeoutMs: 5000, resolver })
    expect(r.status).toBe(200)
  })

  it('🔴 不跟随重定向（302 → 内网就是经典 SSRF 逃逸）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })))
    await expect(guardedFetch('https://api.example.com/x', ['api.example.com'], { timeoutMs: 5000, resolver }))
      .rejects.toThrow(/重定向.*不自动跟随/)
  })

  it('🔴 传给 fetch 的 redirect 必须是 manual', async () => {
    const spy = vi.fn(async (_u: string, _i?: RequestInit) => okRes())
    vi.stubGlobal('fetch', spy)
    await guardedFetch('https://api.example.com/x', ['api.example.com'], { timeoutMs: 5000, resolver })
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
  })

  it('出站前先过白名单，不合规就根本不发请求', async () => {
    const spy = vi.fn(async () => okRes())
    vi.stubGlobal('fetch', spy)
    await expect(guardedFetch('https://evil.com/x', ['api.example.com'], { timeoutMs: 5000, resolver }))
      .rejects.toThrow(NetGuardError)
    expect(spy).not.toHaveBeenCalled()
  })

  it('超时翻成可读错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const e = new Error('aborted'); e.name = 'AbortError'; throw e
    }))
    await expect(guardedFetch('https://api.example.com/x', ['api.example.com'], { timeoutMs: 50, resolver }))
      .rejects.toThrow(/超时/)
  })
})
