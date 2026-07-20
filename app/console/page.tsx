import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 控制台入口：登录后的高保真门户（整屏 iframe 原型 SPA）
// 前端优先阶段：导航/各视图用原型（public/prototype）保真呈现，数据暂为原型内 mock；
// 后续按切片逐个把三级下钻与真实数据接上。未登录访问一律跳 /login。
export default async function ConsolePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <iframe
      src="/prototype/AIPaddle.dc.html"
      title="AIPaddle 控制台"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        border: 'none',
      }}
    />
  )
}
