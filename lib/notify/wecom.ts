import 'server-only'
import { LEAD_FIELDS, EMPTY_PLACEHOLDER, submittedAt, type ChannelResult, type LeadPayload } from './types'

// V12-4.8：企业微信自建应用推送。
//
// 选型经过（2026-07-31 实测，避免后人重走）：
//   · 群机器人 webhook —— 只能发到群，且入口在群聊侧边栏不在管理后台，用户找不到；
//   · 智能机器人（BotID+Secret）—— 主动推送 aibot_send_msg **只能走 WebSocket 长连接**
//     （需心跳保活 + 断线重连），装不进 API Plugin 的 HTTP 模型，为一条通知代价过大；
//   · ✅ 自建应用 —— 纯 HTTP，可私聊推送到指定成员，正合「转发至指定用户」的原始需求。
//
// 🔴 凭证暂存环境变量（ADR-001：密钥只放服务器环境变量）。
// 技术债：P 道 V12-2.6 的 lib/data/credentials.ts 就绪后迁到 credentials 表（kind=api_key）。

const TOKEN_URL = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken'
const SEND_URL = 'https://qyapi.weixin.qq.com/cgi-bin/message/send'

// access_token 有效期 7200s，官方限制取用频率，必须缓存而非每次现取
let cached: { token: string; expiresAt: number } | null = null

type WecomConfig = { corpId: string; corpSecret: string; agentId: string; toUser: string }

function readConfig(): WecomConfig | null {
  const corpId = process.env.WECOM_CORP_ID
  const corpSecret = process.env.WECOM_CORP_SECRET
  const agentId = process.env.WECOM_AGENT_ID
  if (!corpId || !corpSecret || !agentId) return null
  // @all = 推给应用可见范围内所有成员。用它规避通讯录读取权限（自建应用默认无此权限，
  // 调 user/list 会得到 48002），也就不需要维护 userid 列表。
  return { corpId, corpSecret, agentId, toUser: process.env.WECOM_TO_USER || '@all' }
}

async function getToken(cfg: WecomConfig): Promise<string> {
  const now = Date.now()
  if (cached && cached.expiresAt > now + 60_000) return cached.token

  const res = await fetch(`${TOKEN_URL}?corpid=${encodeURIComponent(cfg.corpId)}&corpsecret=${encodeURIComponent(cfg.corpSecret)}`)
  const json = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }
  if (json.errcode !== 0 || !json.access_token) {
    // 60020 = 调用 IP 不在「企业可信IP」白名单内。这是最常见的失败原因，单独点出来
    const hint = json.errcode === 60020 ? '（服务器 IP 未加入企业可信IP白名单）' : ''
    throw new Error(`企微取 token 失败 ${json.errcode}: ${json.errmsg}${hint}`)
  }
  cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 7200) * 1000 }
  return cached.token
}

// 字段与顺序对齐官网既有留资通知（同 email.ts），只有「来源渠道」不同。
function buildMarkdown(lead: LeadPayload): string {
  const rows = LEAD_FIELDS
    .map(f => {
      const v = lead[f.key]
      if (!v) return f.key === 'name' || f.key === 'contact' ? `>${f.label}：**${EMPTY_PLACEHOLDER}**` : null
      const bold = f.key === 'name' || f.key === 'contact'
      return bold ? `>${f.label}：**${String(v)}**` : `>${f.label}：${String(v)}`
    })
    .filter(Boolean)
    .join('\n')

  return [
    '**🔔 官网新客户预约**',
    rows,
    `>来源渠道：<font color="info">${lead.source || '官网'}</font>`,
    `>提交时间：${submittedAt()}`,
    '',
    '<font color="warning">请高润及时跟进！</font>',
  ].join('\n')
}

/** 推送留资通知到企业微信。失败不抛，返回结果由调用方落库。 */
export async function sendWecomLead(lead: LeadPayload): Promise<ChannelResult> {
  const startedAt = Date.now()
  const cfg = readConfig()
  if (!cfg) {
    return { success: false, errorCode: 'not_configured', errorDetail: '企微凭证未配置', latencyMs: 0 }
  }
  try {
    const token = await getToken(cfg)
    const res = await fetch(`${SEND_URL}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        touser: cfg.toUser,
        msgtype: 'markdown',
        agentid: Number(cfg.agentId),
        markdown: { content: buildMarkdown(lead) },
      }),
    })
    const json = (await res.json()) as { errcode?: number; errmsg?: string }
    if (json.errcode !== 0) {
      // token 失效（40014/42001）时清缓存，下次重新取
      if (json.errcode === 40014 || json.errcode === 42001) cached = null
      return {
        success: false, target: cfg.toUser,
        errorCode: String(json.errcode), errorDetail: json.errmsg?.slice(0, 200),
        latencyMs: Date.now() - startedAt,
      }
    }
    return { success: true, target: cfg.toUser, latencyMs: Date.now() - startedAt }
  } catch (e) {
    return {
      success: false, target: cfg.toUser, errorCode: 'exception',
      errorDetail: (e as Error).message.slice(0, 200),
      latencyMs: Date.now() - startedAt,
    }
  }
}

/** 仅供测试重置 token 缓存。 */
export function __resetWecomTokenCache() {
  cached = null
}
