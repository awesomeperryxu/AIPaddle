/**
 * L3 · Tool 下线阻断（V12-3.6 / AC-17）
 *
 * 「下线」不能只是列表里看不见——一个被下线的 Tool 若仍能被已发布的 Skill 调用，
 * 下线就等于没做。本组验证两道：
 *   ① 下线**前**：有已发布 Skill 依赖时先告知影响面，须显式确认才执行
 *   ② 审计：记下影响了谁——事后追查「这个 Skill 什么时候开始不能用的」时，
 *      只有状态变更时间是不够的
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/tools', () => ({ transitionTool: vi.fn() }))
vi.mock('@/lib/data/skill-dependencies', () => ({ listSkillsDependingOn: vi.fn() }))

import { getRequestContext } from '@/lib/context'
import { writeAudit } from '@/lib/data/audit'
import { transitionTool } from '@/lib/data/tools'
import { listSkillsDependingOn } from '@/lib/data/skill-dependencies'
import { POST } from '@/app/api/tools/[id]/transition/route'

const mockCtx = vi.mocked(getRequestContext)
const mockAudit = vi.mocked(writeAudit)
const mockDeps = vi.mocked(listSkillsDependingOn)
const admin: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const ID = '11111111-1111-1111-1111-111111111111'

const post = (body: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }),
       { params: Promise.resolve({ id: ID }) })

const publishedSkill = { skillId: 's1', skillName: '合同审查', skillStatus: 'published' }
const draftSkill = { skillId: 's2', skillName: '草稿技能', skillStatus: 'draft' }

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(admin)
  mockDeps.mockResolvedValue([])
  vi.mocked(transitionTool).mockResolvedValue({ ok: true, status: 'offline' })
})

describe('下线前告知影响面', () => {
  it('🔴 有已发布 Skill 依赖 → 409 + 受影响清单，且不执行流转', async () => {
    mockDeps.mockResolvedValue([publishedSkill])
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('has_dependents')
    expect(body.affectedSkills).toHaveLength(1)
    expect(body.affectedSkills[0].skillName).toBe('合同审查')
    expect(transitionTool, '未确认前不应执行下线').not.toHaveBeenCalled()
  })

  it('带 confirm=true 后放行', async () => {
    mockDeps.mockResolvedValue([publishedSkill])
    const res = await post({ action: 'offline', confirm: true })
    expect(res.status).toBe(200)
    expect(transitionTool).toHaveBeenCalled()
  })

  it('🔴 只拦已发布的 Skill——草稿态依赖不阻止下线', async () => {
    // 草稿态本就跑不起来，拦它只会让人以为下线被无故阻止
    mockDeps.mockResolvedValue([draftSkill])
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(200)
    expect(transitionTool).toHaveBeenCalled()
  })

  it('无依赖时直接下线，不需要确认', async () => {
    const res = await post({ action: 'offline' })
    expect(res.status).toBe(200)
  })

  it('🔴 confirm 只对 offline 生效——其它动作不受影响', async () => {
    mockDeps.mockResolvedValue([publishedSkill])
    vi.mocked(transitionTool).mockResolvedValue({ ok: true, status: 'published' })
    const res = await post({ action: 'approve' })
    expect(res.status, 'approve 不该被依赖检查拦住').toBe(200)
  })
})

describe('审计留痕', () => {
  it('🔴 下线的审计记下影响了哪些 Skill', async () => {
    mockDeps.mockResolvedValue([publishedSkill, draftSkill])
    await post({ action: 'offline', confirm: true })
    const detail = mockAudit.mock.calls[0]?.[4] as Record<string, unknown>
    expect(detail.affectedSkills).toEqual(['合同审查', '草稿技能'])
  })

  it('无影响时不塞空字段', async () => {
    await post({ action: 'offline' })
    const detail = mockAudit.mock.calls[0]?.[4] as Record<string, unknown>
    expect(detail.affectedSkills).toBeUndefined()
    expect(detail.to).toBe('offline')
  })
})
