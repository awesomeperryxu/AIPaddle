/**
 * L3 集成测试 · app/api/templates（GET /api/templates + GET /api/templates/[id]）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/templates', () => ({
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET as LIST } from '@/app/api/templates/route'
import { GET as DETAIL } from '@/app/api/templates/[id]/route'
import { listTemplates, getTemplate } from '@/lib/data/templates'

const mockCtx   = vi.mocked(getRequestContext)
const mockList  = vi.mocked(listTemplates)
const mockGet   = vi.mocked(getTemplate)

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }

const fakeTemplates = [
  { id: 'tpl-1', name: 'YouTube 频道数据分析', type: 'agent',    category: '商业数据分析', description: '...', icon: '📊', iconBackground: '#E0F2FE', tags: ['分析'], dsl: {}, source: 'dify', license: 'Apache-2.0', isBuiltIn: true, createdAt: '2026-01-01' },
  { id: 'tpl-2', name: '名片识别器',           type: 'workflow', category: '团队提效',     description: '...', icon: '📇', iconBackground: '#E0E7FF', tags: ['OCR'],  dsl: {}, source: 'dify', license: 'Apache-2.0', isBuiltIn: true, createdAt: '2026-01-01' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue(fakeTemplates as never)
  mockGet.mockResolvedValue(fakeTemplates[0] as never)
})

// ── GET /api/templates ──────────────────────────────────────────────────────

describe('GET /api/templates', () => {
  const makeReq = (qs = '') =>
    new Request(`http://localhost/api/templates${qs ? `?${qs}` : ''}`)

  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await LIST(makeReq())
    expect(res.status).toBe(401)
  })

  it('200 — 返回全部模板', async () => {
    mockCtx.mockResolvedValue(ctx)
    const res = await LIST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toHaveLength(2)
    expect(mockList).toHaveBeenCalledWith(ctx, { type: undefined, category: undefined, search: undefined })
  })

  it('200 — type 过滤透传', async () => {
    mockCtx.mockResolvedValue(ctx)
    await LIST(makeReq('type=agent'))
    expect(mockList).toHaveBeenCalledWith(ctx, expect.objectContaining({ type: 'agent' }))
  })

  it('200 — category 过滤透传', async () => {
    mockCtx.mockResolvedValue(ctx)
    await LIST(makeReq('category=团队提效'))
    expect(mockList).toHaveBeenCalledWith(ctx, expect.objectContaining({ category: '团队提效' }))
  })

  it('200 — search 过滤透传', async () => {
    mockCtx.mockResolvedValue(ctx)
    await LIST(makeReq('search=名片'))
    expect(mockList).toHaveBeenCalledWith(ctx, expect.objectContaining({ search: '名片' }))
  })

  it('200 — 返回体含 icon/tags/dsl 字段', async () => {
    mockCtx.mockResolvedValue(ctx)
    const res = await LIST(makeReq())
    const body = await res.json()
    const tpl = body.templates[0]
    expect(tpl).toHaveProperty('icon')
    expect(tpl).toHaveProperty('tags')
    expect(tpl).toHaveProperty('dsl')
    expect(tpl).toHaveProperty('isBuiltIn', true)
  })
})

// ── GET /api/templates/[id] ──────────────────────────────────────────────────

const makeDetailReq = (id: string) =>
  new Request(`http://localhost/api/templates/${id}`)
const makeParams = (id: string) =>
  ({ params: Promise.resolve({ id }) }) as { params: Promise<{ id: string }> }

describe('GET /api/templates/[id]', () => {
  it('401 — 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    const res = await DETAIL(makeDetailReq('tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(401)
  })

  it('404 — 模板不存在', async () => {
    mockCtx.mockResolvedValue(ctx)
    mockGet.mockResolvedValue(null)
    const res = await DETAIL(makeDetailReq('no-id'), makeParams('no-id'))
    expect(res.status).toBe(404)
  })

  it('200 — 返回模板详情', async () => {
    mockCtx.mockResolvedValue(ctx)
    const res = await DETAIL(makeDetailReq('tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.template.name).toBe('YouTube 频道数据分析')
    expect(body.template.type).toBe('agent')
    expect(body.template.dsl).toBeDefined()
    expect(mockGet).toHaveBeenCalledWith(ctx, 'tpl-1')
  })
})
