import { describe, it, expect } from 'vitest'
import { extractText, getDocumentProxy } from 'unpdf'
import { generatePdf, generateDocx, generateXlsx } from '@/lib/office/generate'

// 4.2.4 办公文件生成——重点验证 PDF 中文字体嵌入（生成→提取往返中文正确、无降级）
describe('office/generate 中文支持', () => {
  const TITLE = '2026 年度经营分析报告'
  const BODY = '本季度营业收入同比增长 18.2%，客户满意度达 96%。\n下一步：拓展华东市场，优化供应链与人才梯队。'

  it('generatePdf 生成有效 PDF 且中文可正确往返（无降级为 ?）', async () => {
    const bytes = await generatePdf(TITLE, BODY)
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]) // %PDF

    const doc = await getDocumentProxy(new Uint8Array(bytes))
    const { text } = await extractText(doc, { mergePages: true })

    expect(text).toContain('经营分析报告')
    expect(text).toContain('营业收入')
    expect(text).toContain('供应链')
    expect(text).not.toContain('?')
  })

  it('generatePdf 长中文文本按宽度折行并自动分页', async () => {
    const longLine = '中文长文本换行测试。'.repeat(400) // 约 4000 字→多行折行溢出到多页
    const bytes = await generatePdf('分页测试', longLine)
    const doc = await getDocumentProxy(new Uint8Array(bytes))
    expect(doc.numPages).toBeGreaterThan(1)
  })

  it('generateDocx / generateXlsx 生成有效非空文件', async () => {
    const docx = await generateDocx(TITLE, BODY)
    const xlsx = await generateXlsx(TITLE, BODY)
    expect(Array.from(docx.slice(0, 2))).toEqual([0x50, 0x4b]) // PK (zip)
    expect(Array.from(xlsx.slice(0, 2))).toEqual([0x50, 0x4b])
  })
})
