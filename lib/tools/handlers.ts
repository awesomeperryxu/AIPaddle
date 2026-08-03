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

// ── 注册表 ─────────────────────────────────────────────────────────────

const HANDLERS: Record<string, Handler> = {
  [wecomHandler.id]: wecomHandler,
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
