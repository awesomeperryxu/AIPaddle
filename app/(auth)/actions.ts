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
  // Supabase 对「密码错误」与「账号不存在」返回同一错误（防枚举），文案统一
  if (error) redirect('/login?error=invalid_credentials')

  redirect('/dashboard')
}

// register 保留 useActionState 形态：需要在"待邮箱确认"时渲染成功提示而非跳转。
export type AuthState = { error?: string; ok?: boolean; needsConfirm?: boolean }

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const displayName = String(formData.get('displayName') ?? '').trim() || email.split('@')[0]

  if (!EMAIL_RE.test(email)) return { error: '邮箱格式不正确' }
  if (password.length < 8) return { error: '密码至少 8 位' }

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
    if (/registered|already/i.test(error.message)) return { error: '该邮箱已注册' }
    return { error: error.message }
  }
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: '该邮箱已注册' }
  }
  return { ok: true, needsConfirm: !data.session }
}
