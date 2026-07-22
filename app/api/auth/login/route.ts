import { createClient } from '@/lib/supabase/server'

// POST /api/auth/login —— 登录（部署无关化，#61）。
// 从 Server Action 改为稳定 URL 的 Route Handler：URL 不随构建变，避免旧页面提交陈旧 Action ID
// 导致的 "Failed to find Server Action" 登录失败。签发会话 cookie 由请求级客户端的 setAll 写入响应。
// 认证一律走服务端（ADR-001：浏览器永不直连 Supabase）。

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown }
  const email = String(body.email ?? '').trim()
  const password = String(body.password ?? '')

  if (!EMAIL_RE.test(email)) return Response.json({ error: 'email_format' }, { status: 400 })
  if (!password) return Response.json({ error: 'need_password' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // 400=凭证错误（防枚举，账号不存在与密码错误同文案）；其余（422/429 等）单独提示服务问题
    return error.status === 400
      ? Response.json({ error: 'invalid_credentials' }, { status: 401 })
      : Response.json({ error: 'service' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
