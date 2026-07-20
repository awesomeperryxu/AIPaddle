'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 认证一律走服务端（ADR-001：浏览器永不直连 Supabase）。
// 请求级客户端（lib/supabase/server）带该用户会话 cookie，RLS 生效。

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// login：普通 form action + 服务端 redirect（可靠导航），错误经 ?error= 回显。
export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!EMAIL_RE.test(email)) redirect('/login?error=email_format')
  if (!password) redirect('/login?error=need_password')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // 400=凭证错误（防枚举，账号不存在与密码错误同文案）；其余（422 provider 关闭 / 429 限流等）
    // 不该误报成"密码错误"，单独提示服务问题，便于暴露配置故障
    redirect(error.status === 400 ? '/login?error=invalid_credentials' : '/login?error=service')
  }

  redirect('/dashboard')
}

// register：与 login 同构，普通 form action + 服务端 redirect（可靠导航）。
// 关闭邮箱确认 → signUp 直接建 session → 跳 /dashboard；开启确认 → 跳 /register?registered=1 提示查收邮件。
export async function register(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const displayName = String(formData.get('displayName') ?? '').trim() || email.split('@')[0]

  if (!EMAIL_RE.test(email)) redirect('/register?error=email_format')
  if (password.length < 8) redirect('/register?error=password_short')

  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? ''
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    if (/registered|already/i.test(error.message)) redirect('/register?error=exists')
    redirect('/register?error=service')
  }
  // 防枚举：邮箱已存在的已确认用户，signUp 仍返回 user 但 identities 为空
  if (data.user && (data.user.identities?.length ?? 0) === 0) redirect('/register?error=exists')

  if (data.session) redirect('/dashboard')
  redirect('/register?registered=1')
}
