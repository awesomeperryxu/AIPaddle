import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { currentExtensionToken } from './extension-scope'

// 请求级客户端：用于 Server Components / Route Handlers / Server Actions
// 带登录用户会话（auth.uid() 有值）→ RLS 生效，按 org_id 自动隔离（ADR-002 第二层防线）
export async function createClient() {
  // ADR-020 §3：Extension 请求（/api/ext/v1/*）没有 cookie，改带机器用户的短期令牌。
  // 两条路都是**请求级**客户端、都让 auth.uid() 有值、RLS 都照常生效——区别只是
  // 身份从哪来。内部路由取不到 store，走下面原有分支，行为不变。
  const extToken = currentExtensionToken()
  if (extToken) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll() { return [] }, setAll() {} }, // 无会话 cookie，身份全靠下面的 header
        global: { headers: { Authorization: `Bearer ${extToken}` } },
      }
    )
  }

  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // 🔴 给 cookie 设 maxAge=12h，关浏览器后重开仍在（用户要求 12 小时免登录）。
              // 之前剥离 maxAge/expires → 会话 cookie → 关浏览器就清 → 每次都要登录。
              const { maxAge: _m, expires: _e, ...rest } = (options ?? {}) as Record<string, unknown>
              const sessionOpts = { ...rest, maxAge: 12 * 60 * 60 } // 12 小时（秒）
              cookieStore.set(name, value, sessionOpts as Parameters<typeof cookieStore.set>[2])
            })
          } catch {} // Server Component 中 set 会抛出，忽略即可
        },
      },
    }
  )
}
