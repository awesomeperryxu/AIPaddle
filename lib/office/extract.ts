import 'server-only'

// 文档文本提取（#55 · Block B）：按扩展名分派。
// - .txt/.md → UTF-8 解码
// - .pdf → 复用 unpdf（lib/kb/ingest 的 extractPdfText）
// - .docx/.doc/.pptx/.ppt/.xlsx/.xls → officeparser（纯 JS，解析 office 文本）
// 不支持的格式返回中文提示串而非抛错，避免打断助理对话。重型依赖按需动态 import。

const MAX_CHARS = 20000

function cap(text: string): string {
  const t = (text ?? '').trim()
  return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) + '\n…（内容过长已截断）' : t
}

const OFFICE_EXTS = new Set(['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'odt', 'odp', 'ods'])

export async function extractTextFromFile(filename: string, bytes: ArrayBuffer): Promise<string> {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
    return cap(new TextDecoder('utf-8').decode(bytes))
  }
  if (ext === 'pdf') {
    const { extractPdfText } = await import('@/lib/kb/ingest')
    return cap(await extractPdfText(bytes))
  }
  if (OFFICE_EXTS.has(ext)) {
    try {
      const { parseOffice } = await import('officeparser')
      const ast = await parseOffice(bytes, { ocr: false })
      return cap(ast.toText())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return `（.${ext} 文件解析失败：${msg}）`
    }
  }
  return `（暂不支持解析 .${ext || '未知'} 文件）`
}
