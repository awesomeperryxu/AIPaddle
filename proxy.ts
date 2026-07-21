import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_MAX_MS = 24 * 60 * 60 * 1000 // 24 小时强制重登
const COOKIE_MAX_AGE = 24 * 60 * 60 // 会话 cookie 持久 24 小时（跨浏览器关闭保留，与上限一致）
const SESSION_START_COOKIE = 'aipaddle_session_start'

// 将 Supabase cookie 设为持久 24 小时（此前为 session cookie·关浏览器即清除；
// 改为持久后，24 小时内重开浏览器无需重新登录，超过 24h 仍强制重登）。
function toSessionCookieOptions(options: Record<string, unknown> = {}) {
  const { expires: _e, ...rest } = options
  return { ...rest, maxAge: COOKIE_MAX_AGE }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, toSessionCookieOptions(options as Record<string, unknown>))
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isCallback = pathname.startsWith('/auth/callback')
  const isPrototype = pathname.startsWith('/prototype')
  const isPublic = isAuthPage || isCallback || isPrototype

  // 已登录：检查 24h 会话有效期
  if (user) {
    const sessionStart = request.cookies.get(SESSION_START_COOKIE)?.value
    const now = Date.now()

    if (!sessionStart) {
      // 首次请求，打上登录时间戳
      supabaseResponse.cookies.set(SESSION_START_COOKIE, String(now), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE, // 持久 24 小时，跨浏览器关闭保留
      })
    } else if (now - parseInt(sessionStart) > SESSION_MAX_MS) {
      // 超过 24 小时，强制退出
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const response = NextResponse.redirect(url)
      response.cookies.delete(SESSION_START_COOKIE)
      return response
    }
  }

  // 根路径：未登录 → /login，已登录 → 真实应用 /dashboard（不再落到静态原型 /console）
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  // 未登录访问受保护页面 → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 已登录访问认证页 → 工作台首页
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|prototype|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
