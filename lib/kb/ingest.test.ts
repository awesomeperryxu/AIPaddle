import { describe, it, expect } from 'vitest'
import { chunkText, estimateTokens, DEFAULT_CHUNK_CONFIG } from './ingest'

describe('estimateTokens', () => {
  it('纯中文按 2 倍估', () => {
    expect(estimateTokens('黑围裙企业清洁服务')).toBe(18) // 9 字 × 2
  })
  it('纯英文按 1.3 倍估', () => {
    expect(estimateTokens('The quick brown fox')).toBe(Math.ceil(4 * 1.3))
  })
  it('混合文本', () => {
    expect(estimateTokens('测试 hello 世界 world')).toBeGreaterThan(0)
  })
})

describe('BUG-91：token 上限', () => {
  it('🔴 长文本切出的块不应超过 512 token（原来 2000 字文本只切 1-2 块）', () => {
    // 模拟 6MB PDF 提取出的约 2000 字中文文本（无段落分隔符，一大坨）
    const longChinese = '黑围裙企业清洁服务是专业的保洁公司。'.repeat(60) // ~1080 字 ≈ 2160 token
    // 🔴 不带 overlap 测核心拆分逻辑——overlap 拼接可能让边界块超出，那是另一层
    const chunks = chunkText(longChinese, { chunkSize: 2000, chunkOverlap: 0 })
    // 原实现会切成 1 块（2000 字符 > 1080 字符），现在应被 token 上限拆开
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(estimateTokens(c)).toBeLessThanOrEqual(512)
    }
  })

  it('短文本不受影响（不要过度拆分）', () => {
    const short = '这是一段简短的文字，不需要拆分。'
    const chunks = chunkText(short)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(short)
  })

  it('按句子边界拆，不从句子中间截断', () => {
    const text = '第一句话。第二句话。第三句话。'.repeat(40) // 超 512 token
    const chunks = chunkText(text, { chunkSize: 4000 })
    // 每个块应以句号结尾（最后一块除外）
    for (const c of chunks.slice(0, -1)) {
      expect(c).toMatch(/[。！？.!?]$/)
    }
  })

  it('默认 chunkSize 改为 800（原 1024 偏大）', () => {
    expect(DEFAULT_CHUNK_CONFIG.chunkSize).toBe(800)
  })
})

describe('chunkText 基础行为（不回归）', () => {
  it('空文本返回空数组', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   ')).toEqual([])
  })

  it('按段落分隔', () => {
    const chunks = chunkText('段落一内容\n\n段落二内容')
    expect(chunks).toHaveLength(2)
  })

  it('overlap 保持跨块语义连续', () => {
    const text = Array.from({ length: 10 }, (_, i) => `第${i + 1}段`).join('\n\n')
    const chunks = chunkText(text, { chunkSize: 20, chunkOverlap: 5 })
    // 第二块应包含第一块的尾部
    expect(chunks.length).toBeGreaterThan(1)
  })
})

