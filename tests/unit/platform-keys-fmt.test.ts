/**
 * L2 测试 · Key-2 时间格式化（纯函数，不 mock 数据层）
 *
 * 单列一个文件：platform-keys.test.ts 整体 mock 了 @/lib/data/platform-keys，
 * 在那里 import 真实的 fmtTime 会拿到 mock 桩。
 */
import { describe, it, expect } from 'vitest'
import { fmtTime } from '@/lib/data/platform-keys'

describe('fmtTime：UTC → Asia/Shanghai', () => {
  // 🔴 回归守卫：库里存 UTC，不转时区就会差 8 小时——
  // 今晚 20:11 签发的 Key 会显示成 12:11，运营对不上账
  it('跨时区换算 +8', () => {
    expect(fmtTime('2026-08-05T12:11:28.33043+00:00')).toBe('2026-08-05 20:11')
  })

  it('跨日：UTC 前一天晚上 = 北京次日凌晨', () => {
    expect(fmtTime('2026-08-01T17:30:00+00:00')).toBe('2026-08-02 01:30')
  })

  it('null / 非法输入回空串，不抛不显示 Invalid Date', () => {
    expect(fmtTime(null)).toBe('')
    expect(fmtTime('not-a-date')).toBe('')
  })
})
