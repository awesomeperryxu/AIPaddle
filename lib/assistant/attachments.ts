// 个人助理附件（#55 · Block B/C）：纯逻辑，无副作用/无密钥，供 API 路由与单测复用。
// 文档附件（doc）解析出的文本注入 prompt；图片附件（image）以 data URL 走多模态。

import type { ContentPart } from '@/lib/ai'

export type DocAttachment = { kind: 'doc'; filename: string; text: string }
export type ImageAttachment = { kind: 'image'; filename: string; dataUrl: string }
export type Attachment = DocAttachment | ImageAttachment

/** 校验并归一化来自请求体的附件数组（丢弃结构不合法项）。 */
export function parseAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return []
  const out: Attachment[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const filename = typeof o.filename === 'string' ? o.filename : ''
    if (o.kind === 'doc' && typeof o.text === 'string') {
      out.push({ kind: 'doc', filename, text: o.text })
    } else if (o.kind === 'image' && typeof o.dataUrl === 'string' && o.dataUrl.startsWith('data:')) {
      out.push({ kind: 'image', filename, dataUrl: o.dataUrl })
    }
  }
  return out
}

/** 文档附件 → 注入 LLM 的前言文本（据此总结/分析）。无文档返回空串。 */
export function buildDocPreface(docs: DocAttachment[]): string {
  if (docs.length === 0) return ''
  const parts = docs.map((d) => `【${d.filename || '未命名文档'}】\n${d.text}`)
  return `用户上传了以下文档，请据此总结/分析：\n${parts.join('\n\n')}`
}

/**
 * 构建用户消息 content：
 * - 有图片 → 多模态数组 [{text}, {image_url}...]（走 qwen-vl）
 * - 无图片 → 纯字符串
 */
export function buildUserContent(text: string, images: ImageAttachment[]): string | ContentPart[] {
  if (images.length === 0) return text
  const parts: ContentPart[] = [{ type: 'text', text }]
  for (const img of images) parts.push({ type: 'image_url', image_url: { url: img.dataUrl } })
  return parts
}
