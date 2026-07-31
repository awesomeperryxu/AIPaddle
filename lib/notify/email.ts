import 'server-only'
import nodemailer from 'nodemailer'
import { LEAD_FIELDS, EMPTY_PLACEHOLDER, submittedAt, type ChannelResult, type LeadPayload } from './types'

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

// 🔴 版式**逐像素对齐官网既有留资通知**（royalblack 官网 src/app/api/lead/route.js）：
// 同样的标题、表格样式、底部提醒条。高润收到的两种通知只有「来源渠道」一行不同，
// 不必先分辨这是表单来的还是 AI 客服来的。
function buildHtml(lead: LeadPayload): string {
  const row = (label: string, value: string, bold = false) => `
        <tr><td style="padding:8px 0;color:#666;width:90px;">${label}</td><td style="padding:8px 0;${bold ? 'font-weight:600;' : ''}">${esc(value)}</td></tr>`

  const rows = LEAD_FIELDS
    .map(f => {
      const v = lead[f.key]
      // 姓名与联系方式即便为空也占位显示（同官网），其余无值则整行省略
      if (!v) return f.key === 'name' || f.key === 'contact' ? row(f.label, EMPTY_PLACEHOLDER, true) : ''
      return row(f.label, String(v), f.key === 'name' || f.key === 'contact')
    })
    .join('')

  return `
    <div style="font-family:sans-serif;max-width:500px;padding:24px;border:1px solid #eee;border-radius:8px;">
      <h2 style="color:#1a1a1a;margin-top:0;">🔔 官网新客户预约</h2>
      <table style="width:100%;border-collapse:collapse;">${rows}
        ${row('来源渠道', lead.source || '官网')}
        ${row('提交时间', submittedAt())}
      </table>
      <div style="margin-top:20px;padding:12px 16px;background:#f5f0e8;border-radius:6px;color:#8b6914;font-weight:600;">
        请高润及时跟进！
      </div>
    </div>
  `
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
    // 主题同官网格式，便于邮箱里按规则归类
    const subject = `【新预约】${lead.name || '客户'}${lead.project ? ` · ${lead.project}` : ''}`
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
