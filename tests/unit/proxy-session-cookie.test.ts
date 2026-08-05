import { describe, it, expect } from 'vitest'
import { toSessionCookieOptions } from '@/proxy'

// 用户要求 12 小时内免登录（包括关浏览器后重开）。
// toSessionCookieOptions 必须：
//   · 剥离 Supabase 自带的 maxAge/expires（它们可能是 Supabase 的默认值，不是我们想要的）
//   · 注入 maxAge=12h（43200 秒），使 cookie 持久化到关浏览器后仍在
//   · 保留其余安全选项（httpOnly/sameSite/path/secure）

const TWELVE_HOURS = 12 * 60 * 60 // 43200 秒

describe('toSessionCookieOptions（持久 cookie，12h 免登录）', () => {
  it('剥离 Supabase 自带的 maxAge/expires 并替换为 12h', () => {
    const out = toSessionCookieOptions({ maxAge: 3600, expires: new Date(), httpOnly: true, sameSite: 'lax', path: '/' })
    expect(out).not.toHaveProperty('expires')       // expires 一律去掉，只用 maxAge
    expect(out.maxAge).toBe(TWELVE_HOURS)            // 统一为 12h
    expect(out).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('空选项也注入 maxAge=12h', () => {
    expect(toSessionCookieOptions()).toMatchObject({ maxAge: TWELVE_HOURS })
    expect(toSessionCookieOptions({})).toMatchObject({ maxAge: TWELVE_HOURS })
  })

  it('保留安全选项，只替换持久化字段', () => {
    const out = toSessionCookieOptions({ secure: true }) as Record<string, unknown>
    expect(out.maxAge).toBe(TWELVE_HOURS)
    expect(out.secure).toBe(true)
    expect('expires' in out).toBe(false) // expires 不该出现
  })
})
