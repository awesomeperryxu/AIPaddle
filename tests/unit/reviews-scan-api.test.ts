/**
 * L3 测试 · SEC-2/SEC-3 安全核查与自动处理 API 门控
 * 🔴 重点：扫描详情含提示词全文，权限必须与裁决同档，不能只靠 audit:read。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/security-scan', () => ({ scanReviewTarget: vi.fn() }))
vi.mock('@/lib/data/security-scan-write', () => ({ applySecurityAutoFix: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { scanReviewTarget } from '@/lib/data/security-scan'
import { applySecurityAutoFix } from '@/lib/data/security-scan-write'
import { writeAudit } from '@/lib/data/audit'
import { GET } from '@/app/api/reviews/scan/route'
import { POST } from '@/app/api/reviews/autofix/route'

const mockCtx = vi.mocked(getRequestContext)
const mockScan = vi.mocked(scanReviewTarget)
const mockFix = vi.mocked(applySecurityAutoFix)
const mockAudit = vi.mocked(writeAudit)

const reviewer: RequestContext = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const plainUser: RequestContext = { userId: 'u2', orgId: 'o1', roles: ['User'] }
// Auditor 按 ADR-007 持 agent:review（「Admin 或 Auditor 单审即可」），是合法审核者
const auditor: RequestContext = { userId: 'u3', orgId: 'o1', roles: ['Auditor'] }
// Developer 能建 Agent 但无 :review —— 提交人不能自己看自己那份的审核结论并放行
const developer: RequestContext = { userId: 'u4', orgId: 'o1', roles: ['Developer'] }

const scanResult = {
  findings: [], summary: { high: 0, medium: 0, low: 0, passed: 10, na: 0 },
  riskLevel: 'low' as const, autoFixable: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockScan.mockResolvedValue(scanResult)
  mockFix.mockResolvedValue({ config: {}, changes: [{ code: 'moderation-off', description: '已开启内容审核' }], skipped: [] })
})

const scanReq = (qs = 'resourceType=agent&resourceId=a1') =>
  new Request(`http://localhost/api/reviews/scan?${qs}`)
const fixReq = (b: unknown) =>
  new Request('http://localhost/api/reviews/autofix', { method: 'POST', body: JSON.stringify(b) })

describe('GET /api/reviews/scan', () => {
  it('401 未登录', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET(scanReq())).status).toBe(401)
  })

  it('403 普通用户，且不触数据层', async () => {
    mockCtx.mockResolvedValue(plainUser)
    expect((await GET(scanReq())).status).toBe(403)
    expect(mockScan).not.toHaveBeenCalled()
  })

  it('403 Developer——能建 Agent 不代表能审自己提交的那份', async () => {
    mockCtx.mockResolvedValue(developer)
    expect((await GET(scanReq())).status).toBe(403)
    expect(mockScan).not.toHaveBeenCalled()
  })

  it('200 Auditor 是合法审核者（ADR-007：Admin 或 Auditor 单审即可）', async () => {
    mockCtx.mockResolvedValue(auditor)
    expect((await GET(scanReq())).status).toBe(200)
  })

  it('400 非法 resourceType / 缺 resourceId', async () => {
    mockCtx.mockResolvedValue(reviewer)
    expect((await GET(scanReq('resourceType=evil&resourceId=a1'))).status).toBe(400)
    expect((await GET(scanReq('resourceType=agent'))).status).toBe(400)
  })

  it('200 有权限时返回核查结果', async () => {
    mockCtx.mockResolvedValue(reviewer)
    const body = await (await GET(scanReq())).json()
    expect(body.scan.riskLevel).toBe('low')
  })

  it('资源不存在回 200 + scan:null，而非 500', async () => {
    mockCtx.mockResolvedValue(reviewer)
    mockScan.mockResolvedValue(null)
    const res = await GET(scanReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scan).toBeNull()
    expect(body.reason).toBe('not_found')
  })
})

describe('POST /api/reviews/autofix', () => {
  it('403 普通用户，且不写任何配置', async () => {
    mockCtx.mockResolvedValue(plainUser)
    const res = await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: ['moderation-off'] }))
    expect(res.status).toBe(403)
    expect(mockFix).not.toHaveBeenCalled()
  })

  it('400 codes 为空或全部非法', async () => {
    mockCtx.mockResolvedValue(reviewer)
    expect((await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: [] }))).status).toBe(400)
    expect((await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: ['drop-table'] }))).status).toBe(400)
    expect(mockFix).not.toHaveBeenCalled()
  })

  it('400 workflow 不支持自动处理', async () => {
    mockCtx.mockResolvedValue(reviewer)
    expect((await POST(fixReq({ resourceType: 'workflow', resourceId: 'w1', codes: ['moderation-off'] }))).status).toBe(400)
  })

  it('404 资源不存在', async () => {
    mockCtx.mockResolvedValue(reviewer)
    mockFix.mockResolvedValue(null)
    expect((await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: ['moderation-off'] }))).status).toBe(404)
  })

  it('200 处理成功并落审计（detail 不含提示词全文）', async () => {
    mockCtx.mockResolvedValue(reviewer)
    const res = await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: ['moderation-off'] }))
    expect(res.status).toBe(200)
    expect(mockAudit).toHaveBeenCalledWith(
      reviewer, 'security.autofix', 'agent', 'a1',
      expect.objectContaining({ codes: ['moderation-off'] }),
    )
    // 🔴 审计 detail 绝不能带 config/prompt——里面可能有刚被替换掉的密钥
    const detail = JSON.stringify(mockAudit.mock.calls[0][4])
    expect(detail).not.toMatch(/systemPrompt|config/)
  })

  it('无实际变更时不写审计', async () => {
    mockCtx.mockResolvedValue(reviewer)
    mockFix.mockResolvedValue({ config: {}, changes: [], skipped: ['moderation-off'] })
    const res = await POST(fixReq({ resourceType: 'agent', resourceId: 'a1', codes: ['moderation-off'] }))
    expect(res.status).toBe(200)
    expect(mockAudit).not.toHaveBeenCalled()
  })
})
