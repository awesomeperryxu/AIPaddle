import { describe, it, expect } from 'vitest'
import {
  parseAttachments, buildDocPreface, buildUserContent,
  type DocAttachment, type ImageAttachment,
} from '@/lib/assistant/attachments'

// #55 Block B/C：附件纯逻辑（校验 / 文档前言注入 / 多模态 content 构建）

describe('assistant/attachments · parseAttachments', () => {
  it('过滤非法项，保留合法 doc / image', () => {
    const out = parseAttachments([
      { kind: 'doc', filename: 'a.txt', text: '内容' },
      { kind: 'image', filename: 'b.png', dataUrl: 'data:image/png;base64,AAAA' },
      { kind: 'doc', filename: 'c.txt' }, // 缺 text → 丢弃
      { kind: 'image', filename: 'd.png', dataUrl: 'http://x' }, // 非 data: → 丢弃
      null,
      'garbage',
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ kind: 'doc', filename: 'a.txt', text: '内容' })
    expect(out[1].kind).toBe('image')
  })

  it('非数组 → 空数组', () => {
    expect(parseAttachments(undefined)).toEqual([])
    expect(parseAttachments({})).toEqual([])
  })
})

describe('assistant/attachments · buildDocPreface', () => {
  it('无文档 → 空串', () => {
    expect(buildDocPreface([])).toBe('')
  })

  it('多文档 → 含文件名与正文的前言', () => {
    const docs: DocAttachment[] = [
      { kind: 'doc', filename: '报告.docx', text: '营收增长' },
      { kind: 'doc', filename: 'note.txt', text: '备注' },
    ]
    const p = buildDocPreface(docs)
    expect(p).toContain('据此总结/分析')
    expect(p).toContain('【报告.docx】')
    expect(p).toContain('营收增长')
    expect(p).toContain('【note.txt】')
  })
})

describe('assistant/attachments · buildUserContent（多模态）', () => {
  it('无图片 → 纯字符串', () => {
    expect(buildUserContent('总结一下', [])).toBe('总结一下')
  })

  it('有图片 → [text, image_url...] 数组', () => {
    const imgs: ImageAttachment[] = [
      { kind: 'image', filename: 'x.png', dataUrl: 'data:image/png;base64,AAA' },
      { kind: 'image', filename: 'y.jpg', dataUrl: 'data:image/jpeg;base64,BBB' },
    ]
    const content = buildUserContent('看看这些图', imgs)
    expect(Array.isArray(content)).toBe(true)
    const arr = content as Array<Record<string, unknown>>
    expect(arr).toHaveLength(3)
    expect(arr[0]).toEqual({ type: 'text', text: '看看这些图' })
    expect(arr[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } })
    expect(arr[2]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } })
  })
})
