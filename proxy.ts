import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 根路径 → 原型主页（功能开发完成前的临时入口）
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/prototype/AIPaddle.dc.html'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|prototype|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
