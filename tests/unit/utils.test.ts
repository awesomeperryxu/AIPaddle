/**
 * L2 单元测试样例 · lib/utils.ts 的 cn()
 * 作用：验证 Vitest 纯逻辑测试链路可用（0.9b 基建自检）。
 */
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn 合并类名', () => {
  it('拼接多个类名', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('过滤 falsy 值', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('后者覆盖冲突的 Tailwind 类（twMerge）', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('条件对象语法', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
