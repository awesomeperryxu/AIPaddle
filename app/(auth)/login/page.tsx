'use client'

import { Suspense, useEffect } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '../actions'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackError =
    searchParams.get('error') === 'callback_failed' ? '认证回调失败，请重试' : null
  const [state, formAction, pending] = useActionState(login, {})
  const error = state.error ?? callbackError

  // 认证在服务端完成（cookie 已写）；成功后客户端导航到 dashboard
  useEffect(() => {
    if (state.ok) {
      router.replace('/dashboard')
      router.refresh()
    }
  }, [state.ok, router])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
      <h2 className="text-lg font-medium text-white mb-6">登录</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={formAction} noValidate className="space-y-4">
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
