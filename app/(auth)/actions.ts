'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// 认证一律走服务端（ADR-001：浏览器永不直连 Supabase）。
// 请求级客户端（lib/supabase/server）带该用户会话 cookie，RLS 生效。
// 成功后不在 action 内 redirect（useActionState 下客户端不会导航），改由页面客户端导航。

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthState = { error?: string; ok?: boolean; needsConfirm?: boolean }

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!EMAIL_RE.test(email)) return { error: '邮箱格式不正确' }
  if (!password) return { error: '请输入密码' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  // Supabase 对「密码错误」与「账号不存在」返回同一错误（防枚举），文案统一
  if (error) return { error: '账号不存在或密码错误' }

  return { ok: true }
}

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
  // 防枚举：邮箱已存在的已确认用户，signUp 仍返回 user 但 identities 为空
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: '该邮箱已注册' }
  }
  // 关闭邮箱确认 → 已建 session，交页面客户端导航进 dashboard；开启 → 提示查收邮件
  return { ok: true, needsConfirm: !data.session }
}
