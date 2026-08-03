import { signOut } from '@/app/(dashboard)/actions'

// 🔴 兜底页（BUG-93）：有登录会话、但账号不归属任何组织时落到这里。
//
// 在此之前，这种账号会在 / → /dashboard → /login → / 之间死循环，
// 浏览器报 ERR_TOO_MANY_REDIRECTS —— 一个没有任何线索的错误。
//
// 触发场景不止自助注册：邀请流程中途失败、租户被删、用户被移出组织，
// 都会造成「有会话但无 org」。所以这道兜底跟注册开不开无关，必须常驻。

export default function NoAccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white tracking-tight">AIPaddle</h1>
          <p className="mt-1 text-sm text-white/40">企业 AI 业务赋能平台</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-medium text-white mb-3">账号尚未归属企业组织</h2>
          <p className="text-sm text-white/50 leading-relaxed mb-6">
            你已成功登录，但这个账号还没有被分配到任何企业组织，因此无法进入工作台。
            <br />
            <br />
            本平台不开放自助注册，账号需由<strong className="text-white/70">企业管理员</strong>
            在「成员管理」中开通。请联系你所在企业的管理员，或联系平台方开通租户。
          </p>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition"
            >
              退出登录
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
