import 'server-only'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// 办公文件生成（ADR-006 通道①）：平台固定库生成 docx/xlsx/pdf，非 AI 写码。
// docx/xlsx 原生支持中文；pdf 用 pdf-lib 标准字体（拉丁文；中文需嵌入 CJK 字体，见 generatePdf 注释）。

export type OutputFormat = 'docx' | 'xlsx' | 'pdf'

export async function generateDocx(title: string, body: string): Promise<Uint8Array> {
  const paras: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
  ]
  for (const line of body.split('\n')) {
    paras.push(new Paragraph({ children: [new TextRun(line)] }))
  }
  const doc = new Document({ sections: [{ children: paras }] })
  const buf = await Packer.toBuffer(doc)
  return new Uint8Array(buf)
}

/** 把文本按行/制表符转成表格；单纯文本则单列。 */
export async function generateXlsx(title: string, body: string): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(title.slice(0, 28) || 'Sheet1')
  const lines = body.split('\n').filter((l) => l.trim())
  const looksTabular = lines.some((l) => l.includes('\t') || l.includes('|'))
  for (const line of lines) {
    const cells = looksTabular ? line.split(/\t|\s*\|\s*/).filter(Boolean) : [line]
    ws.addRow(cells)
  }
  ws.columns.forEach((c) => { c.width = 32 })
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}

/**
 * PDF 生成。⚠️ pdf-lib 标准字体只含 WinAnsi（拉丁），中文会报错/乱码。
 * 中文 PDF 需 `pdfDoc.embedFont(cjkTtfBytes)`（切片2 收尾接入 Noto Sans SC 子集）。
 * 当前：非拉丁字符降级为 '?'，保证文件可生成、可打开、拉丁内容正确。
 */
export async function generatePdf(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const sanitize = (s: string) => s.replace(/[^\x00-\x7F]/g, '?') // 非 ASCII 降级(待接 CJK 字体)
  let page = pdf.addPage([595, 842])
  let y = 800
  const draw = (text: string, size: number) => {
    if (y < 50) { page = pdf.addPage([595, 842]); y = 800 }
    page.drawText(sanitize(text).slice(0, 90), { x: 50, y, size, font, color: rgb(0.1, 0.1, 0.1) })
    y -= size + 8
  }
  draw(title, 18)
  y -= 6
  for (const line of body.split('\n')) draw(line, 11)
  return pdf.save()
}

export async function generateFile(
  format: OutputFormat,
  title: string,
  body: string,
): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
  switch (format) {
    case 'docx':
      return {
        bytes: await generateDocx(title, body),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: 'docx',
      }
    case 'xlsx':
      return {
        bytes: await generateXlsx(title, body),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: 'xlsx',
      }
    case 'pdf':
      return { bytes: await generatePdf(title, body), contentType: 'application/pdf', ext: 'pdf' }
  }
}
