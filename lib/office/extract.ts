import 'server-only'

// 文档文本提取（#55 · Block B；4.2.6 扩展给知识库多格式）：按扩展名分派。
// - .txt/.md/.markdown/.csv → UTF-8 解码
// - .html/.htm → 解码 + 去标签
// - .pdf → 复用 unpdf（lib/kb/ingest 的 extractPdfText）
// - .docx/.doc/.pptx/.ppt/.xlsx/.xls/.odt/.odp/.ods → officeparser（纯 JS）
// 不支持的格式返回中文提示串而非抛错，避免打断调用方。重型依赖按需动态 import。

const DEFAULT_MAX_CHARS = 20000 // 助理附件默认截断；知识库入库传更大上限

function cap(text: string, maxChars: number): string {
  const t = (text ?? '').trim()
  if (maxChars <= 0) return t
  return t.length > maxChars ? t.slice(0, maxChars) + '\n…（内容过长已截断）' : t
}

const OFFICE_EXTS = new Set(['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'odt', 'odp', 'ods'])
const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv'])
const HTML_EXTS = new Set(['html', 'htm'])

// 知识库支持的全部可解析格式（4.2.6）。用于上传校验 + UI 徽标（诚实展示）。
export const SUPPORTED_DOC_EXTS: string[] = [
  'pdf', ...OFFICE_EXTS, ...TEXT_EXTS, ...HTML_EXTS,
]

export function fileExt(filename: string): string {
  return (filename.split('.').pop() || '').toLowerCase()
}

export function isSupportedDocExt(filename: string): boolean {
  return SUPPORTED_DOC_EXTS.includes(fileExt(filename))
}

// 极简 HTML 去标签（去 script/style + 标签 + 实体），首版够用。
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
}

export async function extractTextFromFile(
  filename: string,
  bytes: ArrayBuffer,
  opts?: { maxChars?: number },
): Promise<string> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS
  const ext = fileExt(filename)
  if (TEXT_EXTS.has(ext)) {
    return cap(new TextDecoder('utf-8').decode(bytes), maxChars)
  }
  if (HTML_EXTS.has(ext)) {
    return cap(htmlToText(new TextDecoder('utf-8').decode(bytes)), maxChars)
  }
  if (ext === 'pdf') {
    const { extractPdfText } = await import('@/lib/kb/ingest')
    return cap(await extractPdfText(bytes), maxChars)
  }
  if (OFFICE_EXTS.has(ext)) {
    try {
      const { parseOffice } = await import('officeparser')
      const ast = await parseOffice(bytes, { ocr: false })
      return cap(ast.toText(), maxChars)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return `（.${ext} 文件解析失败：${msg}）`
    }
  }
  return `（暂不支持解析 .${ext || '未知'} 文件）`
}
