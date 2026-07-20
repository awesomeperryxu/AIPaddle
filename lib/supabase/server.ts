import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 请求级客户端：用于 Server Components / Route Handlers / Server Actions
// 带登录用户会话（auth.uid() 有值）→ RLS 生效，按 org_id 自动隔离（ADR-002 第二层防线）
export async function createClient() {
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
              // 去掉 maxAge/expires，使 Supabase cookie 成为 session cookie
              const { maxAge: _m, expires: _e, ...sessionOpts } = (options ?? {}) as Record<string, unknown>
              cookieStore.set(name, value, sessionOpts as Parameters<typeof cookieStore.set>[2])
            })
          } catch {} // Server Component 中 set 会抛出，忽略即可
        },
      },
    }
  )
}
