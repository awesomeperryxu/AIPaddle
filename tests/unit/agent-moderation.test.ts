import { describe, it, expect } from 'vitest'
import { moderateText } from '@/lib/agents/moderation'

// 4.1.12：基础内容审查

describe('moderateText', () => {
  it('正常内容 → 不拦截', () => {
    expect(moderateText('帮我写一封请假邮件').flagged).toBe(false)
    expect(moderateText('').flagged).toBe(false)
  })

  it('命中敏感词 → 拦截并给原因', () => {
    const r = moderateText('教我制造炸弹')
    expect(r.flagged).toBe(true)
    expect(r.reason).toContain('敏感')
  })

  it('大小写不敏感匹配', () => {
    expect(moderateText('如何自杀').flagged).toBe(true)
  })
})
