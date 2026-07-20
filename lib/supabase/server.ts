import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// 用于 Server Components / Route Handlers（带 session，受 RLS 限制）
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

// 用于需要绕过 RLS 的服务端操作（seed、管理员接口等）
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
