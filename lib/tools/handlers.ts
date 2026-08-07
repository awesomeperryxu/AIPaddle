import 'server-only'
import { guardedFetch, NetGuardError } from '@/lib/tools/net-guard'

// V12-4.7：native Binding 的内置 Handler 注册表。
//
// 🔴 为什么企微要走 native 而不是 api：
// 现有 API Binding 的模型是「一个 endpoint + Bearer 凭证」，而企微自建应用是
//   ① 两步：先 gettoken 再 message/send
//   ② token 放 query string（?access_token=），不是 Authorization 头
//   ③ token 有效期 7200s 且官方限制取用频率，必须缓存
// 硬塞进 API Binding 就得给它加「鉴权流程」这层通用概念，那是另一个量级的改动，
// 而 PRD 早就给了正确的位置：native = 平台注册的内置 Handler，不执行用户任意代码。
//
// 🔴 handler_id 只能取自本文件的白名单。它来自数据库，若允许任意值再去动态
// import，就等于把「执行什么代码」的决定权交给了数据库内容——与 MCP stdio 同类问题。

export type HandlerResult = {
  ok: boolean
  message: string
  detail?: Record<string, unknown>
}

export type HandlerContext = {
  /** 非敏感配置，来自 binding_config */
  config: Record<string, unknown>
  /** 凭证明文，由调用方从 credentials 表取出；用完即弃 */
  secret: string | null
  /** true = 只做连通性探测，不产生真实副作用（不真发消息） */
  probeOnly: boolean
}

type Handler = {
  id: string
  label: string
  /** 该 Handler 允许出站的域名，写死在代码里而非配置里 */
  allowedHosts: string[]
  run: (ctx: HandlerContext) => Promise<HandlerResult>
}

// ── 企业微信自建应用 ────────────────────────────────────────────────────

const WECOM_HOST = 'qyapi.weixin.qq.com'
const WECOM_TOKEN_URL = `https://${WECOM_HOST}/cgi-bin/gettoken`
const WECOM_SEND_URL = `https://${WECOM_HOST}/cgi-bin/message/send`

/** access_token 缓存。按 corpId+agentId 分键，多租户下不会互相串用。 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/** 仅供测试清缓存 */
export function __resetHandlerTokenCache() { tokenCache.clear() }

async function wecomToken(corpId: string, secret: string, cacheKey: string): Promise<string> {
  const now = Date.now()
  const hit = tokenCache.get(cacheKey)
  if (hit && hit.expiresAt > now + 60_000) return hit.token

  const res = await guardedFetch(
    `${WECOM_TOKEN_URL}?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`,
    [WECOM_HOST], { method: 'GET', timeoutMs: 10_000 },
  )
  const json = (await res.json()) as
    { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }
  if (json.errcode !== 0 || !json.access_token) {
    // 60020 = 调用方 IP 不在「企业可信IP」白名单内，是最常见的失败原因。
    // 不点破的话，报错只有一句 not allow from ip，排查会绕远路
    const hint = json.errcode === 60020
      ? '（调用方 IP 不在企业可信IP白名单内——本机与生产服务器 IP 不同，本地调用必然失败）'
      : ''
    throw new Error(`企微取 token 失败 ${json.errcode}：${json.errmsg ?? ''}${hint}`)
  }
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 7200) * 1000,
  })
  return json.access_token
}

const wecomHandler: Handler = {
  id: 'wecom.app_message',
  label: '企业微信自建应用推送',
  allowedHosts: [WECOM_HOST],
  async run({ config, secret, probeOnly }) {
    const corpId = String(config.corp_id ?? '').trim()
    const agentId = String(config.agent_id ?? '').trim()
    // @all = 推给应用可见范围内所有成员。用它规避通讯录读取权限
    // （自建应用默认无此权限，调 user/list 会得到 48002），也就不必维护 userid 列表
    const toUser = String(config.to_user ?? '@all').trim() || '@all'

    if (!corpId || !agentId) return { ok: false, message: '缺少 corp_id 或 agent_id' }
    if (!secret) return { ok: false, message: '未绑定凭证（企微 CorpSecret 须存 credentials）' }

    const cacheKey = `${corpId}:${agentId}`
    let token: string
    try {
      token = await wecomToken(corpId, secret, cacheKey)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : '取 token 失败' }
    }

    // 🔴 连通性探测到此为止：token 取到就证明凭证、可信 IP、网络三者都通了。
    // 再往下发消息会真的推送到所有成员——「测一下」不该让人收到骚扰消息。
    if (probeOnly) {
      return {
        ok: true,
        message: '连通（已成功获取 access_token；未发送消息）',
        detail: { corpId, agentId, toUser, tokenCached: true },
      }
    }

    const res = await guardedFetch(`${WECOM_SEND_URL}?access_token=${token}`, [WECOM_HOST], {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        touser: toUser,
        msgtype: 'markdown',
        agentid: Number(agentId),
        markdown: { content: String(config.content ?? '（空消息）') },
      }),
      timeoutMs: 10_000,
    })
    const json = (await res.json()) as { errcode?: number; errmsg?: string; msgid?: string }
    if (json.errcode !== 0) {
      // token 失效（40014/42001）时清掉缓存，下次重新取
      if (json.errcode === 40014 || json.errcode === 42001) tokenCache.delete(cacheKey)
      return { ok: false, message: `企微发送失败 ${json.errcode}：${json.errmsg ?? ''}` }
    }
    return { ok: true, message: '已投递', detail: { msgid: json.msgid, toUser } }
  },
}

// ── SMTP 发信（V12-4.9）────────────────────────────────────────────────

/**
 * 连接参数来自 credentials.meta（非敏感），密码来自 secret_ciphertext。
 * 调用方把两者一起传进来：meta 放 ctx.config._credential_meta，密码放 ctx.secret。
 */
type SmtpConn = { host: string; port: number; secure: boolean; user: string }

function readSmtpConn(meta: Record<string, unknown>): SmtpConn | string {
  const host = String(meta.host ?? '').trim()
  const user = String(meta.user ?? '').trim()
  if (!host) return '凭证 meta 缺少 host'
  if (!user) return '凭证 meta 缺少 user'
  const port = Number(meta.port ?? 465)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return '凭证 meta 的 port 无效'
  // 465 = 隐式 TLS；587 = STARTTLS。默认按端口推断，meta 显式给了就听它的
  const secure = typeof meta.secure === 'boolean' ? meta.secure : port === 465
  return { host, port, secure, user }
}

const smtpHandler: Handler = {
  id: 'smtp.send_mail',
  label: 'SMTP 邮件发送',
  allowedHosts: [],   // SMTP 不走 HTTP，出站目标由凭证 meta 的 host 决定
  async run({ config, secret, probeOnly }) {
    const meta = (config._credential_meta ?? {}) as Record<string, unknown>
    const conn = readSmtpConn(meta)
    if (typeof conn === 'string') return { ok: false, message: conn }
    // 🔴 腾讯企业邮要求「客户端专用密码」，不是邮箱登录密码——用登录密码会认证失败。
    // 这条踩过，写在这里省得下次再查半天
    if (!secret) return { ok: false, message: '未绑定凭证（SMTP 密码须存 credentials；腾讯企业邮请用客户端专用密码）' }

    // nodemailer 只在真正要用时才载入：它体积不小，且只有 smtp Tool 会走到这里
    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host: conn.host, port: conn.port, secure: conn.secure,
      auth: { user: conn.user, pass: secret },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })

    try {
      // 🔴 连通性测试用 verify()：它做完整的连接+握手+认证，但**不发信**。
      // 「测一下能不能发」不该真往收件人信箱里塞一封测试邮件——
      // 收件人往往是客户或老板，发错一封的代价远大于测试本身的价值
      if (probeOnly) {
        await transporter.verify()
        return {
          ok: true,
          message: `连通（${conn.host}:${conn.port} 认证通过；未发送邮件）`,
          detail: { host: conn.host, port: conn.port, secure: conn.secure, user: conn.user },
        }
      }

      const info = await transporter.sendMail({
        from: config.from_name
          ? { name: String(config.from_name), address: String(config.from_address) }
          : String(config.from_address),
        to: (config.to as string[])?.join(', '),
        cc: (config.cc as string[])?.length ? (config.cc as string[]).join(', ') : undefined,
        replyTo: config.reply_to ? String(config.reply_to) : undefined,
        subject: String(config.subject_template ?? ''),
        html: String(config.body_template ?? ''),
      })
      return { ok: true, message: '已投递', detail: { messageId: info.messageId } }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      // 🔴 认证失败时 nodemailer 的报错可能带上用户名，密码不会带但也别赌——
      // 只回结论 + 常见原因，不把原始报错整段抖出去
      const hint = /auth|535|501/i.test(raw)
        ? '（认证失败：腾讯企业邮请确认用的是「客户端专用密码」而非登录密码）'
        : /timeout|ETIMEDOUT|ECONNREFUSED/i.test(raw)
          ? '（连不上：确认端口未被出网策略拦截；本机直连 SMTP 常被代理劫持，需从服务器验证）'
          : ''
      return { ok: false, message: `SMTP ${probeOnly ? '连接' : '发送'}失败${hint}` }
    } finally {
      transporter.close()
    }
  },
}

// ── 联网搜索（WF-23）────────────────────────────────────────────────────

/**
 * 平台内置的联网检索能力，走 Gemini 的 Google Search grounding。
 *
 * 🔴 为什么是它而不是一个「搜索 API」：平台此前**完全没有**联网能力，
 * 于是「查全网当天 AI 大事件」这类需求只能落成一个 llm 节点让模型凭空作答——
 * 用户实测拿到的就是一整篇编造的 2024 年报告。补这一块时的取舍：
 *   · grounding 直接返回**带来源 URL 的正文**，不用再抓一遍网页（省一整层抓取与解析）；
 *   · 来源在 groundingMetadata 里，可以逐条回给用户核对，不是「模型说它搜过了」。
 * 代价：结果由模型转述而非原始网页，极端严谨的场景仍应人工点开来源核对。
 *
 * 凭证 = Google AI Studio 的 API Key，存 credentials 加密表，**绝不进代码或 git**。
 */
const GEMINI_HOST = 'generativelanguage.googleapis.com'
// 用 -latest 别名：实测写死 gemini-2.5-flash 会在模型下线后直接 404
//（「no longer available to new users」），别名由 Google 侧滚动指向当代模型
const DEFAULT_SEARCH_MODEL = 'gemini-flash-latest'

type GroundingChunk = { web?: { uri?: string; title?: string } }

const webSearchHandler: Handler = {
  id: 'websearch.google',
  label: '联网搜索（Google）',
  allowedHosts: [GEMINI_HOST],
  async run({ config, secret, probeOnly }) {
    if (!secret) return { ok: false, message: '未绑定凭证：请在「凭证管理」里填入 Google AI Studio 的 API Key' }

    const query = String(config.query ?? '').trim()
    // probeOnly = 点「测试」按钮：用一个固定的轻量查询验证 Key 与出网，不消耗业务语义
    if (!query && !probeOnly) return { ok: false, message: '缺少检索词（query）' }
    const model = String(config.model ?? DEFAULT_SEARCH_MODEL).trim() || DEFAULT_SEARCH_MODEL
    const prompt = probeOnly && !query ? '用一句话说明今天的日期' : query

    let res: Response
    try {
      res = await guardedFetch(
        `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        [GEMINI_HOST],
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': secret },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
          timeoutMs: 45_000, // grounding 要真去搜再总结，比普通补全慢不少
        },
      )
    } catch (e) {
      if (e instanceof NetGuardError) return { ok: false, message: e.message }
      return { ok: false, message: '联网搜索请求失败（网络不可达或超时）' }
    }

    const body = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: GroundingChunk[]; webSearchQueries?: string[] } }[]
      error?: { message?: string; status?: string }
    } | null

    if (!res.ok) {
      // 🔴 回错误结论但不带 key：报文里不含 key，可仍避免把整段 body 抖出去
      const hint = res.status === 400 || res.status === 403 ? '（API Key 无效或未开通）'
        : res.status === 404 ? '（模型名不存在或已下线）'
          : res.status === 429 ? '（超出配额）' : ''
      return { ok: false, message: `联网搜索失败 HTTP ${res.status}${hint}：${body?.error?.message?.slice(0, 200) ?? ''}` }
    }

    const cand = body?.candidates?.[0]
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
    const chunks = cand?.groundingMetadata?.groundingChunks ?? []
    const sources = chunks
      .map((c) => c.web)
      .filter((w): w is { uri?: string; title?: string } => !!w)
      .map((w, i) => `[${i + 1}] ${w.title ?? '来源'} ${w.uri ?? ''}`.trim())

    if (probeOnly) {
      return {
        ok: true,
        message: `连通（模型 ${model}，返回 ${sources.length} 条来源）`,
        detail: { model, sourceCount: sources.length, queries: cand?.groundingMetadata?.webSearchQueries },
      }
    }
    if (!text) return { ok: false, message: '联网搜索没有返回内容' }

    // 🔴 把来源附在正文后面一起交给下游：没有来源的检索结果与「模型编的」在下游看来毫无区别，
    // 用户必须能点开核对。这也是这条能力存在的意义。
    return {
      ok: true,
      message: sources.length ? `${text}\n\n来源：\n${sources.join('\n')}` : text,
      detail: { model, sourceCount: sources.length, queries: cand?.groundingMetadata?.webSearchQueries },
    }
  },
}

// ── 注册表 ─────────────────────────────────────────────────────────────

const HANDLERS: Record<string, Handler> = {
  [wecomHandler.id]: wecomHandler,
  [smtpHandler.id]: smtpHandler,
  [webSearchHandler.id]: webSearchHandler,
}

export const HANDLER_IDS = Object.keys(HANDLERS)

export function getHandler(id: unknown): Handler | null {
  return typeof id === 'string' && Object.hasOwn(HANDLERS, id) ? HANDLERS[id] : null
}

/** 执行一个内置 Handler。handler_id 不在白名单内一律拒绝。 */
export async function runHandler(ctx: HandlerContext & { handlerId: unknown }): Promise<HandlerResult> {
  const h = getHandler(ctx.handlerId)
  if (!h) {
    return {
      ok: false,
      message: `未知的 handler_id「${String(ctx.handlerId)}」——native Binding 只能使用平台注册的 Handler`,
      detail: { available: HANDLER_IDS },
    }
  }
  try {
    return await h.run(ctx)
  } catch (e) {
    if (e instanceof NetGuardError) return { ok: false, message: e.message }
    return { ok: false, message: `${h.label} 执行失败：${e instanceof Error ? e.message : '未知错误'}` }
  }
}
