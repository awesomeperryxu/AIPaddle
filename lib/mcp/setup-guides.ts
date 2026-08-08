// MCP Server 接入配置指引。
//
// 背景：平台级 MCP Server 由平台超管统一注册，**凭证由各租户自行配置**
// （租户 A 的 Notion workspace 与租户 B 不是一回事，共用凭证等于跨租户数据泄露）。
// 因此租户 Admin 点开一个 Server 时，必须当场看清「要填什么、去哪拿、要勾哪些权限」，
// 否则就会退化成之前那种体验：只有一句 401，反复换 Key 也不会好。
//
// 🔴 本文件的每一条都来自 2026-08-08 逐家查证的**官方文档**，不是印象。
// 拿不准的（如企业内部服务）如实标注「需企业管理员提供」，绝不编造控制台地址。
//
// 匹配用 endpoint 主机名而非 Server 名称——名称是人填的，会被改。

import type { McpAuthScheme } from './transport'

export type McpExtraField = {
  key: 'username'
  label: string
  placeholder: string
  hint?: string
}

export type McpSetupGuide = {
  /** 凭证类型的官方叫法，照抄对方文档的术语，避免用户在控制台找不到对应入口 */
  credentialLabel: string
  /** 去哪里生成 */
  consoleUrl: string
  consoleLabel: string
  authScheme: McpAuthScheme
  /** 需要勾选的权限/scope。空数组 = 跟随账号自身权限，无需单独勾选 */
  scopes: string[]
  /** 除密钥外还要填的字段（如 Atlassian 的账号邮箱） */
  extraFields: McpExtraField[]
  /** 前置条件——不满足则再怎么配都连不上 */
  prerequisites: string[]
  notes: string[]
  /** true = 该服务不接受静态密钥，只能走 OAuth */
  oauthOnly?: boolean
}

const GUIDES: { match: RegExp; guide: McpSetupGuide }[] = [
  {
    match: /(^|\.)githubcopilot\.com$/i,
    guide: {
      credentialLabel: 'Personal Access Token（classic，ghp_ 开头）',
      consoleUrl: 'https://github.com/settings/tokens',
      consoleLabel: 'GitHub → Settings → Developer settings → Personal access tokens',
      authScheme: 'bearer',
      scopes: ['repo（读写仓库；只读场景可只给 public_repo）', 'read:org（读取组织与团队）'],
      extraFields: [],
      prerequisites: [],
      notes: [
        'classic PAT（ghp_ 开头）下服务端会自动识别 token 的 scope，隐藏你无权使用的工具。',
        '若组织启用了 SAML SSO，生成后需为该 token 单独授权组织访问，否则调用会被拒。',
      ],
    },
  },
  {
    match: /(^|\.)linear\.app$/i,
    guide: {
      credentialLabel: 'Personal API Key',
      consoleUrl: 'https://linear.app/settings/api',
      consoleLabel: 'Linear → Settings → API → Personal API keys → Create key',
      authScheme: 'bearer',
      scopes: [],
      extraFields: [],
      prerequisites: [],
      notes: [
        '权限跟随你本人在 Linear 中的权限，无需单独勾选 scope。',
        '默认端点为读写；只读可改用 https://mcp.linear.app/mcp/readonly。',
      ],
    },
  },
  {
    match: /(^|\.)stripe\.com$/i,
    guide: {
      credentialLabel: 'Restricted API Key（受限密钥）',
      consoleUrl: 'https://dashboard.stripe.com/apikeys',
      consoleLabel: 'Stripe Dashboard → 开发者 → API keys → Create restricted key',
      authScheme: 'bearer',
      scopes: [
        '按需最小授权，只读分析场景建议：Customers 读、Charges 读、Subscriptions 读',
        '涉及退款等写操作时再单独开对应写权限',
      ],
      extraFields: [],
      prerequisites: [],
      notes: [
        '🔴 务必用受限密钥而非标准密钥——这个 Server 能发起真实资金操作，密钥泄露的后果是直接的资金损失。',
        '建议对写类工具开启人工确认。',
      ],
    },
  },
  {
    match: /(^|\.)sentry\.dev$/i,
    guide: {
      credentialLabel: 'User Auth Token',
      consoleUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
      consoleLabel: 'Sentry → Settings → User Auth Tokens → Create New Token',
      authScheme: 'sentry_bearer',
      scopes: ['org:read', 'project:read', 'project:write', 'team:read', 'team:write', 'event:write'],
      extraFields: [],
      prerequisites: [],
      notes: [
        '🔴 scope 在创建时一次性确定、事后不可修改，请一次勾全，否则要重新生成。',
        'Sentry 使用 `Authorization: Sentry-Bearer <token>`（不是标准 Bearer）——本平台已自动按此发送。',
      ],
    },
  },
  {
    match: /(^|\.)cloudflare\.com$/i,
    guide: {
      credentialLabel: 'API Token',
      consoleUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      consoleLabel: 'Cloudflare Dashboard → 我的个人资料 → API 令牌 → 创建令牌',
      authScheme: 'bearer',
      scopes: [
        '按你要操作的资源勾选（如 Workers、DNS、Zone 等）',
        'Account Resources: Read —— 服务端据此自动识别账号 ID，建议务必勾选',
      ],
      extraFields: [],
      prerequisites: [],
      notes: ['用户令牌与账号令牌均可。'],
    },
  },
  {
    match: /(^|\.)atlassian\.com$/i,
    guide: {
      credentialLabel: 'API Token（个人）',
      consoleUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      consoleLabel: 'Atlassian 账号 → 安全 → 创建和管理 API 令牌',
      authScheme: 'basic',
      scopes: [],
      extraFields: [
        {
          key: 'username',
          label: '账号邮箱',
          placeholder: 'me@company.com',
          hint: '与 Token 组成 base64(邮箱:Token) 发送，缺一不可。',
        },
      ],
      prerequisites: [
        '🔴 需组织管理员在 Atlassian 后台**启用 API token 认证**，否则再正确的 token 也会被拒。',
      ],
      notes: [
        '个人 API token 走 Basic 认证；若你拿到的是服务账号密钥，请把认证方式改为 Bearer。',
        '权限跟随该账号在 Jira / Confluence 中的既有权限。',
      ],
    },
  },
  {
    match: /(^|\.)notion\.com$/i,
    guide: {
      credentialLabel: 'OAuth 授权（不支持静态密钥）',
      consoleUrl: 'https://www.notion.com/my-integrations',
      consoleLabel: 'Notion → 设置 → 我的集成',
      authScheme: 'bearer',
      scopes: [],
      extraFields: [],
      prerequisites: [],
      oauthOnly: true,
      notes: [
        '🔴 Notion 官方远程 MCP **明确不支持 bearer token**，只能通过 OAuth 授权连接——填 API Key 一定会失败。',
        'OAuth 接入正在排期；在此之前该 Server 无法通过静态密钥使用。',
        'access token 有效期约 8 小时，需按 expires_in 自动刷新（平台侧会处理）。',
      ],
    },
  },
  {
    match: /(^|\.)huilianyi\.com$/i,
    guide: {
      credentialLabel: '企业接口密钥',
      consoleUrl: '',
      consoleLabel: '需向贵司汇联易管理员索取',
      authScheme: 'bearer',
      scopes: [],
      extraFields: [],
      prerequisites: ['该服务为企业内部系统，密钥由贵司汇联易管理员分配，平台侧无法代为获取。'],
      notes: [],
    },
  },
]

/** 未收录的 Server 用这份通用指引——如实说明「不清楚」，不编造控制台地址。 */
export const GENERIC_GUIDE: McpSetupGuide = {
  credentialLabel: 'API Key / Token',
  consoleUrl: '',
  consoleLabel: '请查阅该服务的官方文档',
  authScheme: 'bearer',
  scopes: [],
  extraFields: [],
  prerequisites: [],
  notes: [
    '平台尚未收录该服务的具体配置要求，请参考其官方文档获取密钥。',
    '多数 MCP 服务使用标准 Bearer；若认证失败，可尝试切换认证方式。',
  ],
}

/** 按 endpoint 主机名取配置指引。名称会被人改，主机名不会。 */
export function getSetupGuide(endpoint: string): McpSetupGuide {
  if (!endpoint) return GENERIC_GUIDE
  let host: string
  try { host = new URL(endpoint).hostname } catch { return GENERIC_GUIDE }
  return GUIDES.find((g) => g.match.test(host))?.guide ?? GENERIC_GUIDE
}
