/**
 * L2 单元测试样例 · components/ui/button.tsx
 * 作用：验证 React Testing Library + jsdom 组件测试链路可用（0.9b 基建自检）。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button 组件', () => {
  it('渲染文案', () => {
    render(<Button>提交</Button>)
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument()
  })

  it('点击触发 onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>点我</Button>)
    await userEvent.click(screen.getByRole('button', { name: '点我' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled 时不触发 onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        禁用
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: '禁用' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
