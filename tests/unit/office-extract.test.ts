import { describe, it, expect } from 'vitest'
import { extractTextFromFile, isSupportedDocExt, fileExt, SUPPORTED_DOC_EXTS } from '@/lib/office/extract'

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

  // 4.2.6：知识库多格式支持
  it('SUPPORTED_DOC_EXTS 含 pdf/office/text/html', () => {
    for (const e of ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'csv', 'html']) {
      expect(SUPPORTED_DOC_EXTS).toContain(e)
    }
  })

  it('isSupportedDocExt / fileExt（大小写不敏感）', () => {
    expect(isSupportedDocExt('数据.XLSX')).toBe(true)
    expect(isSupportedDocExt('报告.pdf')).toBe(true)
    expect(isSupportedDocExt('归档.zip')).toBe(false)
    expect(fileExt('A.PDF')).toBe('pdf')
  })

  it('.html → 去标签保留文本', async () => {
    const html = '<html><head><style>x{}</style></head><body><h1>标题</h1><p>正文&amp;更多</p></body></html>'
    const out = await extractTextFromFile('a.html', buf(html))
    expect(out).toContain('标题')
    expect(out).toContain('正文&更多')
    expect(out).not.toContain('<h1>')
    expect(out).not.toContain('x{}')
  })

  it('.csv → 当作文本解码', async () => {
    expect(await extractTextFromFile('a.csv', buf('姓名,年龄\n张三,30'))).toContain('张三')
  })

  it('maxChars=0 → 不截断', async () => {
    const long = 'a'.repeat(25000)
    const out = await extractTextFromFile('big.txt', buf(long), { maxChars: 0 })
    expect(out.length).toBe(25000)
    expect(out).not.toContain('已截断')
  })
})
