import { describe, it, expect } from 'vitest'
import { extractTextFromFile } from '@/lib/office/extract'

// #55 Block B：文档文本提取按扩展名分派（纯路径不触发重型依赖）

function buf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer
}

describe('office/extract · extractTextFromFile 分派', () => {
  it('.txt → UTF-8 解码原文', async () => {
    const text = await extractTextFromFile('note.txt', buf('你好，世界\nhello'))
    expect(text).toBe('你好，世界\nhello')
  })

  it('.md → UTF-8 解码原文', async () => {
    const text = await extractTextFromFile('README.md', buf('# 标题\n正文内容'))
    expect(text).toContain('# 标题')
    expect(text).toContain('正文内容')
  })

  it('未知扩展名 → 返回中文提示串而非抛错', async () => {
    const text = await extractTextFromFile('archive.zip', buf('binary'))
    expect(text).toBe('（暂不支持解析 .zip 文件）')
  })

  it('无扩展名 → 返回中文提示串', async () => {
    const text = await extractTextFromFile('LICENSE', buf('x'))
    expect(text).toContain('暂不支持解析')
  })

  it('超长文本被截断到上限', async () => {
    const long = '字'.repeat(25000)
    const text = await extractTextFromFile('big.txt', buf(long))
    expect(text.length).toBeLessThan(25000)
    expect(text).toContain('已截断')
  })
})
