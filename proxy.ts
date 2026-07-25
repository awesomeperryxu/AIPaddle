import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_MAX_MS = 24 * 60 * 60 * 1000 // 24 小时绝对上限，超过强制重登
const SESSION_START_COOKIE = 'aipaddle_session_start'

// 将 Supabase 认证 cookie 设为**会话 cookie**（不设 maxAge/expires）：
// - 浏览器不关：cookie 一直在，24 小时内免密（token 到期自动刷新），达 24h 上限强制重登；
// - 浏览器关闭：会话 cookie 被清除 → 下次访问需重新输入密码。
// 剥离 Supabase 可能自带的 maxAge/expires，确保是纯会话 cookie。
export function toSessionCookieOptions(options: Record<string, unknown> = {}) {
  const { expires: _e, maxAge: _m, ...rest } = options
  return rest
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
  const isAuthApi = pathname.startsWith('/api/auth') // 登录/注册 API 路由（未登录须放行，#61 登录部署无关化）
  const isPublic = isAuthPage || isCallback || isPrototype || isAuthApi

  // 已登录：检查 24h 会话有效期
  if (user) {
    const sessionStart = request.cookies.get(SESSION_START_COOKIE)?.value
    const now = Date.now()

    if (!sessionStart) {
      // 首次请求，打上登录时间戳（会话 cookie，不设 maxAge → 关浏览器即清除）
      supabaseResponse.cookies.set(SESSION_START_COOKIE, String(now), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
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
