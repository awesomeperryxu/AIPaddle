import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import ExcelJS from 'exceljs'
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// 办公文件生成（ADR-006 通道①）：平台固定库生成 docx/xlsx/pdf，非 AI 写码。
// docx/xlsx/pdf 均原生支持中文；PDF 通过嵌入 Noto Sans SC 字体支持 CJK（4.2.4）。

// 中文字体（Noto Sans SC 静态 Regular TTF，OFL 许可）。
// 必须用 TrueType(glyf) + subset:false：@pdf-lib/fontkit 的 subset 会造成字形错位（中文乱码，
// 三种字体实测均坏）；CFF/OTF 字体渲染也不可靠。故整字体嵌入，换取正确渲染与全字符覆盖。
const CJK_FONT_PATH = path.join(process.cwd(), 'lib/office/fonts/NotoSansSC-Regular.ttf')
let cjkFontBytesCache: Uint8Array | null = null
async function loadCjkFontBytes(): Promise<Uint8Array> {
  if (!cjkFontBytesCache) {
    const buf = await readFile(CJK_FONT_PATH)
    cjkFontBytesCache = new Uint8Array(buf)
  }
  return cjkFontBytesCache
}

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

// 按字体实际宽度对文本折行（支持中文全角/英文混排），返回若干行
function wrapByWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === '') return ['']
  const out: string[] = []
  let line = ''
  for (const ch of text) {
    const trial = line + ch
    if (line !== '' && font.widthOfTextAtSize(trial, size) > maxWidth) {
      out.push(line)
      line = ch
    } else {
      line = trial
    }
  }
  out.push(line)
  return out
}

/**
 * PDF 生成（4.2.4）。嵌入 Noto Sans SC（TrueType，整字体 subset:false）原生支持中文，
 * 覆盖全部常用汉字且渲染正确；按字体实际宽度折行、自动分页。
 * 注：因 fontkit subset 会致中文字形错位，此处不做子集，单份 PDF 约含 ~6MB 字体。
 */
export async function generatePdf(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  // subset:false —— 见 CJK_FONT_PATH 注释：subset 会导致中文字形错位，故整字体嵌入
  const font = await pdf.embedFont(await loadCjkFontBytes(), { subset: false })

  const PAGE_W = 595
  const PAGE_H = 842
  const MARGIN = 50
  const maxWidth = PAGE_W - MARGIN * 2
  const bottom = 50

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = 800

  const draw = (text: string, size: number, gap: number) => {
    for (const seg of wrapByWidth(text, font, size, maxWidth)) {
      if (y < bottom) { page = pdf.addPage([PAGE_W, PAGE_H]); y = 800 }
      page.drawText(seg, { x: MARGIN, y, size, font, color: rgb(0.1, 0.1, 0.1) })
      y -= size + gap
    }
  }

  draw(title, 18, 10)
  y -= 6
  for (const line of body.split('\n')) draw(line, 11, 7)
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
