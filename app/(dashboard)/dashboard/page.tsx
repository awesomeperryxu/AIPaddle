import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/lib/context'
import { getAgentCount } from '@/lib/data/agents'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const displayName = user.user_metadata?.display_name ?? user.email

  const ctx = await getRequestContext()
  const agentCount = ctx ? await getAgentCount(ctx).catch(() => 0) : 0

  return (
    <div className="min-h-screen bg-[#0f0f0f] px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 顶栏 */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AIPaddle</h1>
            <p className="text-xs text-white/30 mt-0.5">AI 业务赋能平台</p>
          </div>
          <details className="relative">
            <summary
              data-testid="user-menu"
              className="flex items-center gap-2 cursor-pointer list-none rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 [&::-webkit-details-marker]:hidden"
            >
              {displayName}
              <span className="text-white/30">▾</span>
            </summary>
            <div
              role="menu"
              className="absolute right-0 mt-2 w-36 rounded-lg border border-white/10 bg-[#161616] p-1 shadow-xl z-10"
            >
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full text-left rounded-md px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                >
                  退出登录
                </button>
              </form>
            </div>
          </details>
        </header>

        {/* 欢迎卡片 */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          <p className="text-white/50 text-sm mb-1">欢迎回来</p>
          <h2 className="text-2xl font-light text-white">{displayName}</h2>
          <p className="text-white/30 text-xs mt-2">{user.email}</p>
        </div>

        {/* 状态卡片组 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Agent', value: agentCount > 0 ? String(agentCount) : '0', desc: 'Agent 总数' },
            { label: 'Skill', value: '—', desc: '暂未开放' },
            { label: '知识库', value: '—', desc: '暂未开放' },
          ].map(card => (
            <div
              key={card.label}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-xs text-white/40 mb-2">{card.label}</p>
              <p className="text-2xl font-light text-white">{card.value}</p>
              <p className="text-xs text-white/20 mt-1">{card.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/20 pt-4">
          阶段 3 进行中 · 数据层已接通
        </p>
      </div>
    </div>
  )
}
