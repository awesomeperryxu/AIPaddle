import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/data/audit'
import crypto from 'node:crypto'

// POST /api/tenants/[id]/members/[userId]/reset-password
// 平台超管为任意租户的成员重置密码，生成随机密码并发邮件通知
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可操作' } }, { status: 403 })

  const { id: tenantId, userId } = await params
  const admin = createAdminClient()

  const { data: user } = await admin.from('users')
    .select('id,name,email')
    .eq('id', userId).eq('org_id', tenantId).eq('is_service_account', false).is('deleted_at', null)
    .maybeSingle()
  if (!user) return Response.json({ error: { code: 'not_found', message: '成员不存在' } }, { status: 404 })

  // 生成随机密码：12 位
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const newPassword = Array.from(crypto.randomBytes(12), b => chars[b % chars.length]).join('')

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return Response.json({ error: { code: 'server_error', message: error.message } }, { status: 500 })

  // 发邮件通知
  let emailSent = false
  try {
    const nodemailer = (await import('nodemailer')).default
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    if (smtpUser && smtpPass && user.email) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.sendMail({
        from: { name: process.env.SMTP_FROM_NAME || 'AIPaddle 平台', address: smtpUser },
        to: user.email,
        subject: '您的 AIPaddle 账号密码已重置',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a1a1a;">密码已重置</h2>
            <p>您好${user.name ? '，' + user.name : ''}，</p>
            <p>您的 AIPaddle 平台账号密码已由管理员重置。</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#666;">新密码</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:bold;font-family:monospace;color:#1a1a1a;">${newPassword}</p>
            </div>
            <p style="color:#666;font-size:13px;">请登录后在「设置 → 修改密码」中更改为您自己的密码。</p>
            <p style="color:#999;font-size:12px;margin-top:24px;">此邮件由系统自动发送，请勿回复。</p>
          </div>
        `,
      })
      emailSent = true
      transporter.close()
    }
  } catch { /* 邮件失败不阻断重置 */ }

  await writeAudit(ctx, 'member.password_reset_by_platform', 'user', userId, {
    tenantId, emailSent, targetEmail: user.email,
  })

  return Response.json({
    ok: true,
    emailSent,
    message: emailSent
      ? `密码已重置，新密码已发送至 ${user.email}`
      : `密码已重置。邮件发送失败，请手动告知新密码。`,
    // 只在邮件发不出去时才返回密码，否则只经邮件传递
    ...(emailSent ? {} : { tempPassword: newPassword }),
  })
}
