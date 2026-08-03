import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/tools/net-guard', () => ({
  guardedFetch: vi.fn(),
  NetGuardError: class NetGuardError extends Error {},
}))

import { guardedFetch } from '@/lib/tools/net-guard'
import { runHandler, getHandler, HANDLER_IDS, __resetHandlerTokenCache } from './handlers'

const mockFetch = vi.mocked(guardedFetch)
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

const wecomCfg = {
  handler_id: 'wecom.app_message',
  corp_id: 'ww8f153aef2079f2f2',
  agent_id: '1000012',
  to_user: '@all',
  content: '测试消息',
}

beforeEach(() => { vi.clearAllMocks(); __resetHandlerTokenCache() })

describe('Handler 注册表', () => {
  it('🔴 handler_id 只能取自白名单——它来自数据库', () => {
    // 允许任意值再去动态 import，等于把「执行什么代码」交给数据库内容
    expect(getHandler('wecom.app_message')).not.toBeNull()
    expect(getHandler('../../etc/passwd')).toBeNull()
    expect(getHandler('constructor')).toBeNull()   // 原型链上的键不能命中
    expect(getHandler('toString')).toBeNull()
    expect(getHandler(null)).toBeNull()
    expect(getHandler(123)).toBeNull()
  })

  it('未知 handler_id 返回明确结论并列出可用项', async () => {
    const r = await runHandler({ handlerId: 'nope', config: {}, secret: 'x', probeOnly: true })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/未知的 handler_id/)
    expect(r.detail?.available).toEqual(HANDLER_IDS)
  })
})

describe('企微 Handler', () => {
  it('缺 corp_id / agent_id 时明确报出', async () => {
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: { handler_id: 'wecom.app_message' },
      secret: 's', probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/corp_id|agent_id/)
  })

  it('未绑凭证时拒绝，且提示 Secret 须存 credentials', async () => {
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: null, probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/凭证/)
  })

  it('🔴 probeOnly 只取 token，不发消息', async () => {
    // 「点一下测试」不该让全体成员收到骚扰消息
    mockFetch.mockResolvedValueOnce(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true,
    })
    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/未发送消息/)
    expect(mockFetch).toHaveBeenCalledTimes(1)                       // 只有 gettoken
    expect(mockFetch.mock.calls[0][0]).toContain('gettoken')
  })

  it('非 probe 时才真发消息', async () => {
    mockFetch
      .mockResolvedValueOnce(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(json({ errcode: 0, msgid: 'm1' }))
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: false,
    })
    expect(r.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('message/send')
  })

  it('🔴 出站域名白名单写死在代码里，不取自配置', async () => {
    mockFetch.mockResolvedValueOnce(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
    await runHandler({
      handlerId: 'wecom.app_message',
      // 配置里塞一个恶意域名，不应影响实际允许的出站目标
      config: { ...wecomCfg, allowed_hosts: ['evil.com'] },
      secret: 'sec', probeOnly: true,
    })
    expect(mockFetch.mock.calls[0][1]).toEqual(['qyapi.weixin.qq.com'])
  })

  it('token 按 corpId:agentId 缓存，第二次不再取', async () => {
    mockFetch.mockResolvedValue(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
    await runHandler({ handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true })
    await runHandler({ handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('🔴 不同租户的 corpId 不共用 token 缓存', async () => {
    mockFetch.mockResolvedValue(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
    await runHandler({ handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true })
    await runHandler({
      handlerId: 'wecom.app_message', config: { ...wecomCfg, corp_id: 'ww_other' },
      secret: 'sec2', probeOnly: true,
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('60020 单独给出可信 IP 的提示', async () => {
    // 这是最常见的失败原因，只报 not allow from ip 会让人排查绕远路
    mockFetch.mockResolvedValueOnce(json({ errcode: 60020, errmsg: 'not allow to access from your ip' }))
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/可信IP/)
  })

  it('token 失效（40014/42001）时清缓存', async () => {
    mockFetch
      .mockResolvedValueOnce(json({ errcode: 0, access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(json({ errcode: 42001, errmsg: 'access_token expired' }))
      .mockResolvedValueOnce(json({ errcode: 0, access_token: 'tok2', expires_in: 7200 }))
      .mockResolvedValueOnce(json({ errcode: 0, msgid: 'm2' }))
    const bad = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: false,
    })
    expect(bad.ok).toBe(false)
    // 缓存已清 → 这次会重新 gettoken
    const good = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: false,
    })
    expect(good.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('Handler 抛异常时收敛成结论：带上 message 便于诊断，但不带堆栈', async () => {
    const err = new Error('ECONNREFUSED')
    err.stack = 'Error: ECONNREFUSED\n    at Socket._onError (/app/node_modules/net.js:1:1)'
    mockFetch.mockRejectedValueOnce(err)
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'sec', probeOnly: true,
    })
    expect(r.ok).toBe(false)
    // message 要保留 —— 「执行失败」四个字帮不上任何排查
    expect(r.message).toMatch(/ECONNREFUSED/)
    // 但不能把 stack 抖出去：里面有服务器上的真实路径
    expect(JSON.stringify(r)).not.toContain('node_modules')
    expect(JSON.stringify(r)).not.toContain('_onError')
  })

  it('🔴 凭证与 access_token 都不出现在返回里', async () => {
    // token 值取一个有辨识度的串：早先用 'tok' 时会撞上 detail.tokenCached 字段名，
    // 断言假红，看着像泄漏其实不是
    mockFetch.mockResolvedValueOnce(
      json({ errcode: 0, access_token: 'ACCESS_TOKEN_XYZ', expires_in: 7200 }))
    const r = await runHandler({
      handlerId: 'wecom.app_message', config: wecomCfg, secret: 'SUPER_SECRET_VALUE', probeOnly: true,
    })
    const dump = JSON.stringify(r)
    expect(dump).not.toContain('SUPER_SECRET_VALUE')
    expect(dump).not.toContain('ACCESS_TOKEN_XYZ')
  })
})
