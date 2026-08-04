import { describe, it, expect } from 'vitest'
import { chunkText, normalizeChunkConfig, DEFAULT_CHUNK_CONFIG } from '@/lib/kb/ingest'

// 4.2.7：切块参数可配。纯函数（不触发 supabase/嵌入）。

describe('normalizeChunkConfig 规整', () => {
  it('缺省回落默认 800/50', () => {
    expect(normalizeChunkConfig(undefined)).toEqual(DEFAULT_CHUNK_CONFIG)
    expect(normalizeChunkConfig(null)).toEqual(DEFAULT_CHUNK_CONFIG)
  })

  it('chunkSize 夹取 [50,4000]', () => {
    expect(normalizeChunkConfig({ chunkSize: 10 }).chunkSize).toBe(50)
    expect(normalizeChunkConfig({ chunkSize: 99999 }).chunkSize).toBe(4000)
  })

  it('overlap 恒小于 size（防死循环）', () => {
    const c = normalizeChunkConfig({ chunkSize: 100, chunkOverlap: 500 })
    expect(c.chunkOverlap).toBe(99)
    expect(c.chunkOverlap).toBeLessThan(c.chunkSize)
  })

  it('overlap 负数归零', () => {
    expect(normalizeChunkConfig({ chunkOverlap: -5 }).chunkOverlap).toBe(0)
  })
})

describe('chunkText 按参数切块', () => {
  it('无分隔符时按长度+重叠切窗口', () => {
    const text = 'a'.repeat(250)
    const parts = chunkText(text, { chunkSize: 100, chunkOverlap: 20, separator: '' })
    expect(parts[0].length).toBe(100)
    expect(parts.length).toBeGreaterThan(2) // step=80 → 100/180/250...
  })

  it('分隔符切分：块不跨语义段', () => {
    const text = '第一段内容\n\n第二段内容'
    const parts = chunkText(text, { chunkSize: 1000, chunkOverlap: 0, separator: '\n\n' })
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain('第一段')
    expect(parts[1]).toContain('第二段')
  })

  it('默认参数（不传 config）按 800 切窗口（BUG-91 降低默认值）', () => {
    const text = '字'.repeat(2000)
    const parts = chunkText(text)
    // BUG-91：原 1024 字符的中文约 2000 token，远超嵌入最佳区间。
    // 降到 800 后，enforceTokenLimit 还会按 512 token 上限再拆，
    // 所以第一块可能短于 800——但绝不应该是 1024
    expect(parts[0].length).toBeLessThanOrEqual(800)
    expect(parts.length).toBeGreaterThan(1)
  })

  it('空文本 → 空数组', () => {
    expect(chunkText('   ', { chunkSize: 100, chunkOverlap: 0, separator: '' })).toEqual([])
  })
})
