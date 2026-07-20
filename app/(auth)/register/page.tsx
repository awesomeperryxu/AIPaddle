'use client'

import { Suspense } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { register } from '../actions'

const ERR_MAP: Record<string, string> = {
  email_format: '邮箱格式不正确',
  password_short: '密码至少 8 位',
  exists: '该邮箱已注册',
  service: '注册服务暂不可用，请稍后重试',
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition mt-2"
    >
      {pending ? '注册中...' : '注册'}
    </button>
  )
}

function RegisterInner() {
  const searchParams = useSearchParams()
  const error = ERR_MAP[searchParams.get('error') ?? '']
  const registered = searchParams.get('registered') === '1'

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">✉️</div>
          <p className="text-white font-medium">注册成功！</p>
          <p className="text-white/40 text-sm">请查收验证邮件完成激活，然后登录。</p>
          <Link href="/login" className="inline-block text-indigo-400 hover:text-indigo-300 text-sm transition">
            去登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white tracking-tight">AIPaddle</h1>
          <p className="mt-1 text-sm text-white/40">企业 AI 业务赋能平台</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          <h2 className="text-lg font-medium text-white mb-6">注册账号</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form action={register} noValidate className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-xs text-white/50 mb-1.5">显示名称</label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                placeholder="你的名字"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
              />
            </div>

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
              <label htmlFor="password" className="block text-xs text-white/50 mb-1.5">密码（至少 8 位）</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
              />
            </div>

            <SubmitButton />
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            已有账号？{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f0f]" />}>
      <RegisterInner />
    </Suspense>
  )
}
