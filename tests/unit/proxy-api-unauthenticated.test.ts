/**
 * BUG-98：未登录访问 /api/* 必须回 401 JSON，不能重定向。
 *
 * 为什么这条值得单独钉住：
 * 307 会**保留请求方法**。浏览器收到 307 后拿原样的 POST 去请求 /login，
 * 而那是页面不是接口 → 405。用户创建知识库时看到的「Method Not Allowed」
 * 就是这么来的，完全指不到「登录过期」这个真实原因。
 *
 *   POST /api/knowledge-bases → 307 → POST /login → 405
 *
 * 线上 nginx 日志坐实了这条链路，不是推测。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase 客户端整体 mock：本测试只关心中间件的分流，不碰真实会话
const getUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}))

import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

const req = (path: string, method = 'GET') =>
  new NextRequest(new URL(`http://localhost:3000${path}`), { method })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
  getUser.mockResolvedValue({ data: { user: null } })   // 未登录
})

describe('未登录访问 /api/*', () => {
  it('🔴 回 401 JSON，不是重定向', async () => {
    const res = await proxy(req('/api/knowledge-bases', 'POST'))
    expect(res.status).toBe(401)
    expect(res.headers.get('location')).toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('unauthenticated')
    expect(body.error.message).toMatch(/登录已过期/)
  })

  it('各类写方法都回 401，不留任何重定向口子', async () => {
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const res = await proxy(req('/api/documents', m))
      expect(res.status, m).toBe(401)
      expect(res.headers.get('location'), m).toBeNull()
    }
  })

  it('GET 同样回 401（前端也是 fetch 拿 JSON）', async () => {
    const res = await proxy(req('/api/agents'))
    expect(res.status).toBe(401)
  })

  it('🔴 登录接口本身必须放行，否则没法登录', async () => {
    const res = await proxy(req('/api/auth/login', 'POST'))
    expect(res.status).not.toBe(401)
  })

  it('🔴 对外 Extension API 仍放行（它有自己的 Key 鉴权，ADR-020）', async () => {
    // 这里若被中间件拦成 401，外部系统拿到的就不是端点内 guard 给的结论了
    const res = await proxy(req('/api/ext/v1/chat', 'POST'))
    expect(res.status).not.toBe(401)
  })

  it('页面路径仍走重定向（人在浏览器里该被送去登录页）', async () => {
    const res = await proxy(req('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/\/login/)
  })
})

describe('已登录时不受影响', () => {
  it('API 请求正常放行', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { org_id: 'org1' } } },
    })
    const res = await proxy(req('/api/knowledge-bases', 'POST'))
    expect(res.status).not.toBe(401)
  })
})
