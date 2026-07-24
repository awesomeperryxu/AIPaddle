/**
 * 4.4.11 · 批量运行输入解析
 */
import { describe, it, expect } from 'vitest'
import { parseBatchInputs, MAX_BATCH } from '@/lib/workflow/batch'

describe('parseBatchInputs', () => {
  it('字符串数组原样返回，不截断', () => {
    const r = parseBatchInputs(['a', 'b', 'c'])
    expect(r.inputs).toEqual(['a', 'b', 'c'])
    expect(r.truncated).toBe(false)
  })

  it('超过上限 → 截断并标记 truncated', () => {
    const many = Array.from({ length: MAX_BATCH + 5 }, (_, i) => `x${i}`)
    const r = parseBatchInputs(many)
    expect(r.inputs).toHaveLength(MAX_BATCH)
    expect(r.truncated).toBe(true)
  })

  it('非字符串元素被强制转字符串', () => {
    const r = parseBatchInputs([1, true, null])
    expect(r.inputs).toEqual(['1', 'true', ''])
  })

  it('非数组 → 空', () => {
    expect(parseBatchInputs('nope').inputs).toEqual([])
    expect(parseBatchInputs(undefined).inputs).toEqual([])
  })

  it('自定义上限生效', () => {
    const r = parseBatchInputs(['a', 'b', 'c'], 2)
    expect(r.inputs).toEqual(['a', 'b'])
    expect(r.truncated).toBe(true)
  })
})
