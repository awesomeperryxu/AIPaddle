import { describe, it, expect } from 'vitest'
import { toSessionCookieOptions } from '@/proxy'

// 会话 cookie（关浏览器即清除）+ 24h 上限：cookie 选项必须剥离 maxAge/expires，
// 使其成为纯会话 cookie（浏览器关闭清除 → 需重新输密码；不关则 24h 内免密）。

describe('toSessionCookieOptions（会话 cookie）', () => {
  it('剥离 Supabase 自带的 maxAge 和 expires → 会话 cookie', () => {
    const out = toSessionCookieOptions({ maxAge: 3600, expires: new Date(), httpOnly: true, sameSite: 'lax', path: '/' })
    expect(out).not.toHaveProperty('maxAge')
    expect(out).not.toHaveProperty('expires')
    // 其余安全选项保留
    expect(out).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('空选项安全返回', () => {
    expect(toSessionCookieOptions()).toEqual({})
    expect(toSessionCookieOptions({})).toEqual({})
  })

  it('不注入任何持久化字段（无 maxAge/expires 即会话 cookie）', () => {
    const out = toSessionCookieOptions({ secure: true }) as Record<string, unknown>
    expect('maxAge' in out).toBe(false)
    expect('expires' in out).toBe(false)
    expect(out.secure).toBe(true)
  })
})
