'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

const ERR_MAP: Record<string, string> = {
  email_format: '邮箱格式不正确',
  need_password: '请输入密码',
  invalid_credentials: '账号不存在或密码错误',
  service: '登录服务暂不可用，请稍后重试或联系管理员',
  callback_failed: '认证回调失败，请重试',
  network: '网络异常，请重试',
  registration_closed: '本平台不开放自助注册，账号请由企业管理员开通',
}

// BUG-72：导航兜底时长。超过这个时间还停在本页，说明跳转没走成，
// 得把控制权还给用户，而不是让按钮永久停在 disabled 的「登录中...」。
const NAV_FALLBACK_MS = 6000

function LoginForm() {
  const searchParams = useSearchParams()
  // BUG-72：原先只有一个 pending 布尔量，成功后置 true 便再不复位——
  // 认证其实已成功、cookie 已签发，用户看到的却仍是「登录中...」，
  // 一旦导航没走成（/dashboard 加载慢、或 cookie 落盘与导航竞态被 getUser() 弹回），
  // 就永久卡死只能刷新。改为三态，把「认证中」与「正在进入」分开表达。
  const [phase, setPhase] = useState<'idle' | 'authenticating' | 'redirecting'>('idle')
  const [navStalled, setNavStalled] = useState(false)
  const [errCode, setErrCode] = useState('')
  // 初次进入可能带 ?error=（如回调失败）；提交后以 fetch 错误码为准
  const error = ERR_MAP[errCode || (searchParams.get('error') ?? '')]
  const busy = phase !== 'idle'

  // 登录改走稳定 URL 的 API 路由（部署无关化）；成功后整页硬跳转 /dashboard（可靠导航，cookie 已签发）
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setPhase('authenticating')
    setNavStalled(false)
    setErrCode('')
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      })
      if (res.ok) {
        setPhase('redirecting')
        // 导航成功则本页随即卸载，下面的定时器不会有机会生效；
        // 没生效才说明卡住了——那时给出手动入口，不让用户只能刷新
        setTimeout(() => setNavStalled(true), NAV_FALLBACK_MS)
        window.location.href = '/dashboard'
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setErrCode(j.error ?? 'service')
      setPhase('idle')
    } catch {
      setErrCode('network')
      setPhase('idle')
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

      {/* BUG-72：导航迟迟不走时的出口。认证已成功、会话已建立，
          此时最该做的是让用户能自己进去，而不是干等或刷新重来。 */}
      {navStalled && (
        <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300">
          登录已成功，但页面跳转较慢。
          <a href="/dashboard" className="ml-1 underline underline-offset-2 hover:text-amber-200">
            点此进入工作台
          </a>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="block text-xs text-white/50 mb-1.5">邮箱</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
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
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition mt-2"
        >
          {phase === 'authenticating' ? '登录中...' : phase === 'redirecting' ? '登录成功，正在进入…' : '登录'}
        </button>
      </form>

      {/* 自助注册已关闭（BUG-93）：账号由平台开租户、租户管理员邀请成员产生 */}
      <p className="mt-6 text-center text-xs text-white/30">
        没有账号？请联系企业管理员开通
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
