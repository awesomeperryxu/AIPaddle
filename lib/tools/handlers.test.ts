import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
// nodemailer 用 mock：真连 SMTP 既慢又会真发信，而「不发信」正是要验的
const mockVerify = vi.fn(async () => true)
const mockSendMail = vi.fn(async (_opts: Record<string, unknown>) => ({ messageId: 'mid-1' }))
const mockClose = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ verify: mockVerify, sendMail: mockSendMail, close: mockClose }) },
}))
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

beforeEach(() => {
  vi.clearAllMocks(); __resetHandlerTokenCache()
  mockVerify.mockResolvedValue(true)
  mockSendMail.mockResolvedValue({ messageId: 'mid-1' })
})

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

describe('SMTP Handler', () => {
  const smtpCfg = {
    handler_id: 'smtp.send_mail',
    from_address: 'a@x.com', from_name: '发件人',
    to: ['b@x.com'], cc: [], reply_to: '',
    subject_template: '主题', body_template: '<p>正文</p>',
    _credential_meta: { host: 'smtp.exmail.qq.com', port: 465, user: 'a@x.com' },
  }

  it('缺 host / user 时明确报出，而不是笼统失败', async () => {
    for (const meta of [{ user: 'u' }, { host: 'h' }]) {
      const r = await runHandler({
        handlerId: 'smtp.send_mail', config: { ...smtpCfg, _credential_meta: meta },
        secret: 'p', probeOnly: true,
      })
      expect(r.ok).toBe(false)
      expect(r.message).toMatch(/host|user/)
    }
  })

  it('未绑凭证时拒绝，并点出腾讯企业邮要用客户端专用密码', async () => {
    const r = await runHandler({
      handlerId: 'smtp.send_mail', config: smtpCfg, secret: null, probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/客户端专用密码/)
  })

  it('port 非法时拒绝', async () => {
    const r = await runHandler({
      handlerId: 'smtp.send_mail',
      config: { ...smtpCfg, _credential_meta: { host: 'h', user: 'u', port: 99999 } },
      secret: 'p', probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/port/)
  })

  it('🔴 失败信息里不含密码', async () => {
    const r = await runHandler({
      handlerId: 'smtp.send_mail',
      config: { ...smtpCfg, _credential_meta: { host: 'h', user: 'u', port: 0 } },
      secret: 'SUPER_SECRET_PASSWORD', probeOnly: true,
    })
    expect(JSON.stringify(r)).not.toContain('SUPER_SECRET_PASSWORD')
  })

  it('🔴 probeOnly 只做 verify()，绝不发信', async () => {
    // 收件人往往是客户或老板。「测一下能不能发」真发出一封的代价，
    // 远大于这次测试本身的价值
    const r = await runHandler({
      handlerId: 'smtp.send_mail', config: smtpCfg, secret: 'pw', probeOnly: true,
    })
    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/未发送邮件/)
    expect(mockVerify).toHaveBeenCalledTimes(1)
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('非 probe 时才真发信，且带上收件人与主题', async () => {
    const r = await runHandler({
      handlerId: 'smtp.send_mail', config: smtpCfg, secret: 'pw', probeOnly: false,
    })
    expect(r.ok).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockSendMail.mock.calls[0]?.[0]).toMatchObject({ to: 'b@x.com', subject: '主题' })
  })

  it('连接用完即关，不留连接泄漏', async () => {
    await runHandler({ handlerId: 'smtp.send_mail', config: smtpCfg, secret: 'pw', probeOnly: true })
    expect(mockClose).toHaveBeenCalled()
  })

  it('🔴 verify 失败时不含密码，且给出可操作提示', async () => {
    mockVerify.mockRejectedValueOnce(new Error('535 Error: authentication failed for user@x.com'))
    const r = await runHandler({
      handlerId: 'smtp.send_mail', config: smtpCfg, secret: 'SUPER_SECRET_PASSWORD', probeOnly: true,
    })
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r)).not.toContain('SUPER_SECRET_PASSWORD')
    expect(r.message).toMatch(/客户端专用密码/)
  })

  it('smtp.send_mail 已注册在白名单里', () => {
    expect(HANDLER_IDS).toContain('smtp.send_mail')
    expect(getHandler('smtp.send_mail')).not.toBeNull()
  })
})

describe('联网搜索 Handler（WF-23）', () => {
  const cfg = { handler_id: 'websearch.google', query: '2026年8月6日 AI 领域重大新闻' }
  const grounded = (text: string, sources: { title: string; uri: string }[]) => json({
    candidates: [{
      content: { parts: [{ text }] },
      groundingMetadata: {
        webSearchQueries: ['AI news August 6 2026'],
        groundingChunks: sources.map((s) => ({ web: s })),
      },
    }],
  })

  it('返回正文并附上真实来源——没有来源就与「模型编的」无从区分', async () => {
    mockFetch.mockResolvedValueOnce(grounded('今日 AI 要闻三条……', [
      { title: 'openai.com', uri: 'https://openai.com/blog/x' },
      { title: '9to5mac.com', uri: 'https://9to5mac.com/y' },
    ]))
    const r = await runHandler({ handlerId: 'websearch.google', config: cfg, secret: 'KEY', probeOnly: false })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('今日 AI 要闻三条')
    expect(r.message).toContain('https://openai.com/blog/x')
    expect(r.detail?.sourceCount).toBe(2)
  })

  it('未绑定凭证 → 明确指向凭证管理，不去发请求', async () => {
    const r = await runHandler({ handlerId: 'websearch.google', config: cfg, secret: null, probeOnly: false })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('凭证')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('缺检索词 → 不发请求', async () => {
    const r = await runHandler({ handlerId: 'websearch.google', config: { handler_id: 'websearch.google' }, secret: 'K', probeOnly: false })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('检索词')
  })

  it('probeOnly 用固定轻量查询验证 Key，不需要业务检索词', async () => {
    mockFetch.mockResolvedValueOnce(grounded('今天是 2026-08-07', []))
    const r = await runHandler({ handlerId: 'websearch.google', config: { handler_id: 'websearch.google' }, secret: 'K', probeOnly: true })
    expect(r.ok).toBe(true)
    expect(r.message).toContain('连通')
  })

  it('🔴 出站域名锁死在 Google 的 API 主机上', async () => {
    mockFetch.mockResolvedValueOnce(grounded('x', []))
    await runHandler({ handlerId: 'websearch.google', config: cfg, secret: 'K', probeOnly: false })
    const [url, hosts] = mockFetch.mock.calls[0]
    expect(String(url)).toContain('generativelanguage.googleapis.com')
    expect(hosts).toEqual(['generativelanguage.googleapis.com'])
  })

  it('🔴 API Key 走请求头，不出现在 URL 里（URL 会进日志/审计）', async () => {
    mockFetch.mockResolvedValueOnce(grounded('x', []))
    await runHandler({ handlerId: 'websearch.google', config: cfg, secret: 'SUPER_SECRET_KEY', probeOnly: false })
    const [url, , init] = mockFetch.mock.calls[0]
    expect(String(url)).not.toContain('SUPER_SECRET_KEY')
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('SUPER_SECRET_KEY')
  })

  it('模型下线（404）时给出可操作提示——写死模型名踩过这个坑', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'no longer available' } }), { status: 404 }))
    const r = await runHandler({ handlerId: 'websearch.google', config: cfg, secret: 'K', probeOnly: false })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('模型名不存在或已下线')
  })

  it('Key 无效（403）时不把 Key 抖出去', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'permission denied' } }), { status: 403 }))
    const r = await runHandler({ handlerId: 'websearch.google', config: cfg, secret: 'SUPER_SECRET_KEY', probeOnly: false })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('API Key 无效')
    expect(JSON.stringify(r)).not.toContain('SUPER_SECRET_KEY')
  })

  it('websearch.google 已注册在白名单里', () => {
    expect(HANDLER_IDS).toContain('websearch.google')
    expect(getHandler('websearch.google')).not.toBeNull()
  })
})
