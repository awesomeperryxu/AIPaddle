import { describe, it, expect, vi, beforeEach } from 'vitest'

// 个人助理资源端点（切片3）：只返回已发布 Agent/Skill + 知识库。

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/agents', () => ({
  listAgents: vi.fn().mockResolvedValue([
    { id: 'a1', name: '已发布Agent', status: 'published' },
    { id: 'a2', name: '草稿Agent', status: 'draft' },
  ]),
}))
vi.mock('@/lib/data/skills', () => ({
  listSkills: vi.fn().mockResolvedValue([
    { id: 's1', name: '已发布Skill', status: 'published' },
    { id: 's2', name: '待审Skill', status: 'pending' },
  ]),
}))
vi.mock('@/lib/data/knowledge', () => ({
  listKnowledgeBases: vi.fn().mockResolvedValue([{ id: 'k1', name: 'KB', documentCount: 3 }]),
}))

import { getRequestContext } from '@/lib/context'
import { GET } from '@/app/api/assistant/resources/route'

const mockCtx = vi.mocked(getRequestContext)

describe('个人助理资源端点（切片3）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('只返回已发布 Agent/Skill + 全部知识库', async () => {
    mockCtx.mockResolvedValue({ userId: 'u1', orgId: 'o1', roles: ['User'] } as never)
    const body = await (await GET()).json()
    expect(body.agents).toEqual([{ id: 'a1', name: '已发布Agent' }])
    expect(body.skills).toEqual([{ id: 's1', name: '已发布Skill' }])
    expect(body.knowledgeBases).toEqual([{ id: 'k1', name: 'KB', documentCount: 3 }])
  })
})
