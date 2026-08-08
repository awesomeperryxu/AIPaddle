/**
 * 单元 · MCP 接入配置指引（按 host 匹配）
 *
 * 这份指引直接决定租户 Admin 能不能自助配通。之前的体验是：点开只有一句 401，
 * 用户不知道要什么 token、去哪拿、要勾哪些权限，只能反复换 Key 试。
 *
 * 🔴 这里重点钉两件事：
 *   ① 按 **endpoint 主机名** 匹配而非 Server 名称——名称是人填的，改名就失配；
 *   ② 未收录的服务落到通用指引，**如实说明不清楚**，绝不编造控制台地址
 *      （编造比留白更糟：用户会照着一个不存在的页面找半天）。
 */
import { describe, it, expect } from 'vitest'
import { getSetupGuide, GENERIC_GUIDE } from '@/lib/mcp/setup-guides'

describe('按 endpoint 主机名匹配', () => {
  it.each([
    ['https://api.githubcopilot.com/mcp/', 'Personal Access Token', 'bearer'],
    ['https://mcp.linear.app/mcp', 'Personal API Key', 'bearer'],
    ['https://mcp.stripe.com', 'Restricted API Key', 'bearer'],
    ['https://mcp.sentry.dev/mcp', 'User Auth Token', 'sentry_bearer'],
    ['https://mcp.cloudflare.com/mcp', 'API Token', 'bearer'],
    ['https://mcp.atlassian.com/v1/mcp/authv2', 'API Token', 'basic'],
  ])('%s → %s', (endpoint, labelPart, scheme) => {
    const g = getSetupGuide(endpoint)
    expect(g.credentialLabel).toContain(labelPart)
    expect(g.authScheme).toBe(scheme)
  })

  it('路径不同不影响匹配（同一 host 的不同端点形态）', () => {
    expect(getSetupGuide('https://mcp.linear.app/mcp/readonly').credentialLabel)
      .toBe(getSetupGuide('https://mcp.linear.app/mcp').credentialLabel)
  })

  it('不匹配子串伪装的域名', () => {
    // 🔴 用 endsWith 语义而非 includes：evil-stripe.com.attacker.io 不该拿到 Stripe 的指引
    expect(getSetupGuide('https://mcp.stripe.com.attacker.io/mcp')).toBe(GENERIC_GUIDE)
  })
})

describe('关键配置信息必须齐全', () => {
  it('Sentry 列出全部 scope，且点明创建后不可改', () => {
    const g = getSetupGuide('https://mcp.sentry.dev/mcp')
    for (const s of ['org:read', 'project:read', 'event:write']) {
      expect(g.scopes.join(' ')).toContain(s)
    }
    expect(g.notes.join(' ')).toMatch(/不可修改|一次性/)
  })

  it('Atlassian 要求账号邮箱，并点明需管理员先启用', () => {
    const g = getSetupGuide('https://mcp.atlassian.com/v1/mcp/authv2')
    expect(g.extraFields.map((f) => f.key)).toContain('username')
    expect(g.prerequisites.join(' ')).toMatch(/管理员/)
  })

  it('Notion 明确标注只能 OAuth，避免用户白填 Key', () => {
    const g = getSetupGuide('https://mcp.notion.com/mcp')
    expect(g.oauthOnly).toBe(true)
    expect(g.notes.join(' ')).toMatch(/不支持 bearer token|一定会失败/)
  })

  it('Stripe 提示用受限密钥——它能发起真实资金操作', () => {
    const g = getSetupGuide('https://mcp.stripe.com')
    expect(g.notes.join(' ')).toMatch(/受限密钥|资金/)
  })

  it('GitHub 给出 repo / read:org 两个 scope', () => {
    const g = getSetupGuide('https://api.githubcopilot.com/mcp/')
    expect(g.scopes.join(' ')).toMatch(/repo/)
    expect(g.scopes.join(' ')).toMatch(/read:org/)
  })
})

describe('不编造信息', () => {
  it('未收录的服务落到通用指引，且不给控制台地址', () => {
    const g = getSetupGuide('https://mcp.unknown-vendor.example/mcp')
    expect(g).toBe(GENERIC_GUIDE)
    expect(g.consoleUrl).toBe('')
    expect(g.notes.join(' ')).toMatch(/尚未收录|官方文档/)
  })

  it('企业内部服务不编控制台地址，如实指向企业管理员', () => {
    const g = getSetupGuide('https://hlymcp.huilianyi.com:8443/mcp')
    expect(g.consoleUrl).toBe('')
    expect(`${g.consoleLabel} ${g.prerequisites.join(' ')}`).toMatch(/管理员/)
  })

  it('非法 endpoint 不抛错，退化为通用指引', () => {
    expect(getSetupGuide('not-a-url')).toBe(GENERIC_GUIDE)
    expect(getSetupGuide('')).toBe(GENERIC_GUIDE)
  })

  it('每条收录的指引都有可跳转的控制台地址（企业内部除外）', () => {
    const hosted = [
      'https://api.githubcopilot.com/mcp/', 'https://mcp.linear.app/mcp',
      'https://mcp.stripe.com', 'https://mcp.sentry.dev/mcp',
      'https://mcp.cloudflare.com/mcp', 'https://mcp.atlassian.com/v1/mcp/authv2',
    ]
    for (const e of hosted) {
      expect(getSetupGuide(e).consoleUrl, e).toMatch(/^https:\/\//)
    }
  })
})
