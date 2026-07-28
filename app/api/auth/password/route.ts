import { getRequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { checkPassword } from '@/lib/auth/password'
import { writeAudit } from '@/lib/data/audit'

/**
 * 4.8.18c：用户自行修改密码。
 *
 * 4.8.18 起账号由创建人指定初始密码，若没有这个入口，初始密码会长期不变——
 * 那才是真正的风险。故本接口是 a/b 两项的必要配套。
 *
 * 安全取舍：**要求输入原密码**。Supabase 的 updateUser 凭当前会话即可改密，
 * 不验原密码；但那样一旦会话被盗（如共用电脑未登出），攻击者能直接改密踢走本人。
 * 这里用「原密码登录一次」来确认操作者确实知道原密码。
 */
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  const currentPassword = typeof b?.currentPassword === 'string' ? b.currentPassword : ''
  const newPassword = typeof b?.newPassword === 'string' ? b.newPassword : ''

  if (!currentPassword) {
    return Response.json({ error: { code: 'invalid', message: '请输入原密码' } }, { status: 400 })
  }
  const pwdErr = checkPassword(newPassword)
  if (pwdErr) return Response.json({ error: { code: 'invalid', message: `新${pwdErr}` } }, { status: 400 })
  if (newPassword === currentPassword) {
    return Response.json({ error: { code: 'invalid', message: '新密码不能与原密码相同' } }, { status: 400 })
  }

  const supabase = await createClient()

  // 取当前用户邮箱用于验证原密码（不采信前端传入的身份）
  const { data: userRes } = await supabase.auth.getUser()
  const email = userRes?.user?.email
  if (!email) {
    return Response.json({ error: { code: 'unauthenticated', message: '会话已失效，请重新登录' } }, { status: 401 })
  }

  // 用原密码登录一次以验证身份；失败即原密码错误
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyErr) {
    return Response.json({ error: { code: 'invalid', message: '原密码不正确' } }, { status: 400 })
  }

  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword })
  if (updErr) {
    return Response.json({ error: { code: 'server_error', message: updErr.message } }, { status: 500 })
  }

  // 审计只记「谁在何时改了密码」，绝不记密码本身
  await writeAudit(ctx, 'member.password_changed', 'user', ctx.userId, {})
  return Response.json({ ok: true })
}
