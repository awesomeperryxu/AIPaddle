'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const ERR_MAP: Record<string, string> = {
  email_format: '邮箱格式不正确',
  need_password: '请输入密码',
  invalid_credentials: '账号不存在或密码错误',
  service: '登录服务暂不可用，请稍后重试或联系管理员',
  callback_failed: '认证回调失败，请重试',
  network: '网络异常，请重试',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [errCode, setErrCode] = useState('')
  // 初次进入可能带 ?error=（如回调失败）；提交后以 fetch 错误码为准
  const error = ERR_MAP[errCode || (searchParams.get('error') ?? '')]

  // 登录改走稳定 URL 的 API 路由（部署无关化）；成功后整页硬跳转 /dashboard（可靠导航，cookie 已签发）
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setErrCode('')
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      if (res.ok) {
        window.location.href = '/dashboard'
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setErrCode(j.error ?? 'service')
      setPending(false)
    } catch {
      setErrCode('network')
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
      <h2 className="text-lg font-medium text-white mb-6">登录</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs text-white/50 mb-1.5">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs text-white/50 mb-1.5">密码</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition mt-2"
        >
          {pending ? '登录中...' : '登录'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-white/30">
        没有账号？{' '}
        <Link href="/register" className="text-indigo-400 hover:text-indigo-300 transition">
          注册
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white tracking-tight">AIPaddle</h1>
          <p className="mt-1 text-sm text-white/40">企业 AI 业务赋能平台</p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 p-8 h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
