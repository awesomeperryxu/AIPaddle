import 'server-only'
import nodemailer from 'nodemailer'
import { LEAD_FIELDS, type ChannelResult, type LeadPayload } from './types'

// V12-4.8：SMTP 邮件通知（腾讯企业邮，2026-07-31 实测打通）。
//
// 🔴 密码必须是「客户端专用密码」，不是邮箱登录密码——用登录密码会认证失败。
// 🔴 凭证暂存环境变量（ADR-001）。技术债：P 道 V12-2.6 的 credentials 数据层就绪后
//    迁到 credentials 表（kind='smtp'，0035 已加该枚举），host/port/user 进 meta、
//    密码进 secret_ciphertext。
// 📌 本机直连 SMTP 会被代理劫持，验证与生产发信均需从服务器出（见 ISSUES 记录）。

type SmtpConfig = {
  host: string; port: number; user: string; pass: string
  fromName: string; to: string[]
}

function readConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const to = (process.env.NOTIFY_EMAIL_TO ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!user || !pass || to.length === 0) return null
  return {
    host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
    port: Number(process.env.SMTP_PORT || 465),
    user, pass,
    fromName: process.env.SMTP_FROM_NAME || '黑围裙官网线索',
    to,
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function buildHtml(lead: LeadPayload): string {
  const rows = LEAD_FIELDS
    .map(f => {
      const v = lead[f.key]
      if (!v) return null
      return `<tr>
        <td style="padding:12px 16px;background:#fafafa;width:110px;color:#666;font-size:14px;border-top:1px solid #eee">${f.label}</td>
        <td style="padding:12px 16px;font-size:15px;border-top:1px solid #eee">${esc(String(v))}</td>
      </tr>`
    })
    .filter(Boolean)
    .join('')

  const summary = lead.conversationSummary
    ? `<div style="padding:14px 16px;background:#fff;border:1px solid #e5e5e5;border-top:none;font-size:13px;line-height:1.8;color:#444">
         <div style="color:#999;font-size:12px;margin-bottom:6px">咨询摘要</div>${esc(lead.conversationSummary)}
       </div>`
    : ''

  return `<div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#17171a;color:#c9a45c;padding:18px 24px;border-radius:8px 8px 0 0">
    <div style="font-size:13px;letter-spacing:3px;opacity:.7">ROYALBLACK · 官网线索</div>
    <div style="font-size:20px;font-weight:700;margin-top:6px">新客户咨询</div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e5e5;border-top:none">${rows}</table>
  ${summary}
  <div style="padding:14px 16px;background:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#999">
    来源：${esc(lead.source ?? 'website')} · AIPaddle 智能顾问
  </div>
</div>`
}

/** 发送留资通知邮件。失败不抛，返回结果由调用方落库。 */
export async function sendEmailLead(lead: LeadPayload): Promise<ChannelResult> {
  const startedAt = Date.now()
  const cfg = readConfig()
  if (!cfg) {
    return { success: false, errorCode: 'not_configured', errorDetail: 'SMTP 凭证未配置', latencyMs: 0 }
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465, // 465 走 SSL，587 走 STARTTLS
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 15_000,
    })
    const subject = `【黑围裙官网】新线索 · ${lead.name}${lead.project ? ` · ${lead.project}` : ''}`
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.user}>`,
      to: cfg.to.join(', '),
      subject,
      html: buildHtml(lead),
    })
    return { success: true, target: cfg.to.join(','), latencyMs: Date.now() - startedAt }
  } catch (e) {
    const msg = (e as Error).message ?? ''
    // 认证失败几乎都是用了登录密码而非客户端专用密码，把这条线索直接写进错误里
    const errorCode = /Invalid login|535|authentication/i.test(msg) ? 'auth_failed' : 'send_failed'
    const hint = errorCode === 'auth_failed' ? '（需使用客户端专用密码，非登录密码）' : ''
    return {
      success: false, target: cfg.to.join(','),
      errorCode, errorDetail: (msg + hint).slice(0, 200),
      latencyMs: Date.now() - startedAt,
    }
  }
}
