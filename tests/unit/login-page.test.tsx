/**
 * L2 测试 · BUG-72 登录卡「登录中...」不跳转
 *
 * 原缺陷：成功后 pending 置 true 便再不复位，`window.location.href` 一赋值就 return。
 * 认证其实已成功、cookie 已签发，但只要导航没走成，用户就永久停在 disabled 的
 * 「登录中...」，除了刷新别无出路——且文案还让人以为是登录本身失败了。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

// jsdom 不允许真的赋值 window.location.href，替换成可观测的桩
const navigated: string[] = []
beforeEach(() => {
  navigated.length = 0
  vi.stubGlobal('location', { get href() { return 'http://localhost/login' }, set href(v: string) { navigated.push(v) } })
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const fill = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.type(screen.getByLabelText('邮箱'), 'a@b.com')
  await u.type(screen.getByLabelText('密码'), 'pw123456')
  await u.click(screen.getByRole('button', { name: /登录/ }))
}

describe('登录成功后的阶段反馈', () => {
  it('认证成功 → 文案变「正在进入」并发起导航（不再谎称仍在登录）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<LoginPage />)
    await fill(u)

    await waitFor(() => expect(navigated).toContain('/dashboard'))
    expect(screen.getByRole('button')).toHaveTextContent('登录成功，正在进入…')
  })

  // 🔴 核心回归：导航没走成时必须给出口，而不是永久 disabled
  it('导航迟迟不生效 → 出现手动进入入口', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<LoginPage />)
    await fill(u)
    await waitFor(() => expect(navigated).toContain('/dashboard'))

    // 兜底触发前不该出现，否则正常登录也会闪一下这个提示
    expect(screen.queryByText(/跳转较慢/)).toBeNull()

    await vi.advanceTimersByTimeAsync(6000)
    await waitFor(() => expect(screen.getByText(/登录已成功，但页面跳转较慢/)).toBeTruthy())
    expect(screen.getByRole('link', { name: /点此进入工作台/ })).toHaveAttribute('href', '/dashboard')
  })
})

describe('失败路径仍可重试', () => {
  it('凭证错误 → 复位为可提交，并显示对应文案', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ error: 'invalid_credentials' }),
    }))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<LoginPage />)
    await fill(u)

    await waitFor(() => expect(screen.getByText('账号不存在或密码错误')).toBeTruthy())
    const btn = screen.getByRole('button', { name: /登录/ })
    expect(btn).not.toBeDisabled()
    expect(btn).toHaveTextContent('登录')
    expect(navigated).toHaveLength(0)
  })

  it('网络异常 → 复位为可提交', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<LoginPage />)
    await fill(u)

    await waitFor(() => expect(screen.getByText('网络异常，请重试')).toBeTruthy())
    expect(screen.getByRole('button', { name: /登录/ })).not.toBeDisabled()
  })
})
