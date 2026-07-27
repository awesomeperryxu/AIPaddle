import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

// BUG-78：知识库创建向导分段预览——PDF/Office 服务端抽取真实文本端点

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/office/extract', () => ({
  extractTextFromFile: vi.fn(),
  isSupportedDocExt: vi.fn(() => true),
}))

import { getRequestContext } from '@/lib/context'
import { extractTextFromFile, isSupportedDocExt } from '@/lib/office/extract'
import { POST } from '@/app/api/knowledge-bases/preview/route'

const mockCtx = vi.mocked(getRequestContext)
const mockExtract = vi.mocked(extractTextFromFile)
const mockSupported = vi.mocked(isSupportedDocExt)

const admin: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const user: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }

function req(file?: File): Request {
  const fd = new FormData()
  if (file) fd.append('file', file)
  return { formData: async () => fd } as unknown as Request
}
const pdf = () => new File([new Uint8Array([1, 2, 3])], 'report.pdf')

describe('POST /api/knowledge-bases/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupported.mockReturnValue(true)
  })

  it('未登录 → 401，不解析', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await POST(req(pdf()))).status).toBe(401)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('无 knowledge:create（User）→ 403，不解析', async () => {
    mockCtx.mockResolvedValueOnce(user)
    expect((await POST(req(pdf()))).status).toBe(403)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('缺文件 → 400', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    expect((await POST(req())).status).toBe(400)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('不支持类型 → 400', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockSupported.mockReturnValueOnce(false)
    expect((await POST(req(new File([new Uint8Array([1])], 'a.exe')))).status).toBe(400)
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('Admin + PDF → 200，返回真实抽取文本', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockExtract.mockResolvedValueOnce('这是 PDF 里的真实内容。')
    const res = await POST(req(pdf()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ text: '这是 PDF 里的真实内容。', filename: 'report.pdf' })
    expect(mockExtract).toHaveBeenCalledWith('report.pdf', expect.anything(), { maxChars: 8000 })
  })

  it('解析失败 → 422', async () => {
    mockCtx.mockResolvedValueOnce(admin)
    mockExtract.mockRejectedValueOnce(new Error('损坏的文件'))
    expect((await POST(req(pdf()))).status).toBe(422)
  })
})
