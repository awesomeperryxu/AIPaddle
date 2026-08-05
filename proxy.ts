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

// _next/* 请求直接放行，不建 Supabase 客户端、不打远程调用。
// getUser() 每次 ~220ms（广州→澳洲），一个页面加载触发多次 _next/data，全跳过 = 省 1~2 秒。
const SKIP_AUTH_PREFIXES = ['/_next/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 快速路径
  if (SKIP_AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

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

  // refresh token 失效时静默处理（user=null → 视为未登录），不刷屏报错
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { /* refresh token 失效 */ }
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  // 🔴 /no-access 必须放行：它正是「有会话但无组织」的落点，
  // 若被当成受保护页面，它自己也会被踢去 /login，循环照旧
  const isNoAccess = pathname.startsWith('/no-access')
  const isCallback = pathname.startsWith('/auth/callback')
  const isPrototype = pathname.startsWith('/prototype')
  const isAuthApi = pathname.startsWith('/api/auth') // 登录/注册 API 路由（未登录须放行，#61 登录部署无关化）
  // 🔴 V12-8.11：对外 Extension API 必须放行会话检查。
  // 它有**自己的一套鉴权**（API Key + 机器用户身份，见 ADR-020），外部系统不带
  // Supabase 会话 Cookie。若在此处拦截，请求会被 307 重定向到 /login——外部拿到的是
  // 一个跳转而不是 401，既调不通也看不出原因。
  // 放行不等于不鉴权：guardExtensionRequest 在端点内做 Key 校验 / Origin 白名单 /
  // Scope / 限流，未通过一样拒绝。
  const isExtApi = pathname.startsWith('/api/ext/')
  const isPublic = isAuthPage || isNoAccess || isCallback || isPrototype || isAuthApi || isExtApi

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

  // 🔴 有会话但账号无组织归属 → /no-access（BUG-93）。
  // 原先只校验「有无 auth 会话」，不校验「有无组织」，于是这类账号在
  // / → /dashboard → /login → / 之间死循环，浏览器报 ERR_TOO_MANY_REDIRECTS。
  //
  // 只在需要跳转的分支查库，不是每个请求都查——中间件跑在每次导航上，
  // 无脑加一次 DB 往返会拖慢所有页面。
  async function hasOrg(): Promise<boolean> {
    if (!user) return false
    if (typeof user.app_metadata?.org_id === 'string' && user.app_metadata.org_id) return true
    const { data } = await supabase.from('users').select('org_id').eq('id', user.id).maybeSingle()
    return !!(data as { org_id?: string } | null)?.org_id
  }

  // 根路径：未登录 → /login，已登录 → 真实应用 /dashboard（不再落到静态原型 /console）
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? (await hasOrg() ? '/dashboard' : '/no-access') : '/login'
    return NextResponse.redirect(url)
  }

  // 🔴 未登录访问 /api/* → 回 401 JSON，**不能重定向**（BUG-98）。
  //
  // 307 会保留请求方法：浏览器收到 307 后会拿原样的 POST 去请求 /login，
  // 而那是个页面不是接口，于是回 405 —— 用户看到的是莫名其妙的
  // 「Method Not Allowed」，完全指不到「登录过期」这个真实原因。
  // 用户创建知识库时就是这么撞上的：
  //   POST /api/knowledge-bases → 307 → POST /login → 405
  //
  // 这个道理在下面 /api/ext/ 的注释里早就写过（外部拿到跳转而非 401，
  // 既调不通也看不出原因），却没意识到**内部 API 被 fetch 调用时完全一样**。
  if (!user && pathname.startsWith('/api/') && !isAuthApi && !isExtApi) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: '登录已过期，请重新登录' } },
      { status: 401 },
    )
  }

  // 未登录访问受保护页面 → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 已登录访问认证页 → 工作台首页；无组织的直接送去 /no-access，
  // 不再弹回 / 让它再绕一圈
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = await hasOrg() ? '/' : '/no-access'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|prototype|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
