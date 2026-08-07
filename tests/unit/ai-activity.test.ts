/**
 * L2 测试 · WF-16 AI 操作记录
 *
 * 用户诉求：能随时查到「对话里系统自动帮我建了什么」——创建人、时间、对象、成功与否。
 * 🔴 关键点：失败也必须能查到。只显示成功记录的看板等于没有监督，
 * 用户回头想问「那次为什么没建出来」将无从查起。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rows: unknown[] = []
const builder = {
  select: vi.fn(() => builder),
  in: vi.fn(() => builder),
  order: vi.fn(() => builder),
  limit: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  then: (res: (v: { data: unknown[]; error: null }) => unknown) => res({ data: rows, error: null }),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => builder }) }))

import { listAiActivity, AI_ACTION_KEYS } from '@/lib/data/ai-activity'

const ctx = { userId: 'u1', orgId: 'o1', roles: ['Admin'] }
const row = (action: string, detail: Record<string, unknown> = {}, id = 'a1') => ({
  id, action, target_type: 'workflow', target_id: 'w1', detail,
  actor_id: 'u1', created_at: '2026-08-07T00:00:00Z', actor: { name: '张三' },
})

beforeEach(() => { rows.length = 0; vi.clearAllMocks() })

describe('记录规格化', () => {
  it('成功的创建记录带上对象类型、创建人、原始描述', async () => {
    rows.push(row('workflow.copilot_created', { name: 'AI日报', description: '每天8点汇总AI大事件', ready: true }))
    const [a] = await listAiActivity(ctx)
    expect(a).toMatchObject({
      object: 'workflow', verb: '生成工作流', name: 'AI日报',
      success: true, actorName: '张三', prompt: '每天8点汇总AI大事件',
    })
  })

  it('失败记录能查到，且带出失败原因', async () => {
    rows.push(row('workflow.copilot_failed', { description: 'xxx', success: false, error: '模型未能生成任何节点' }))
    const [a] = await listAiActivity(ctx)
    expect(a.success).toBe(false)
    expect(a.reason).toBe('模型未能生成任何节点')
  })

  it('detail.success=false 也判为失败（两种记法都认）', async () => {
    rows.push(row('agent.copilot_create', { success: false }))
    const [a] = await listAiActivity(ctx)
    expect(a.success).toBe(false)
    expect(a.reason).toBe('未记录原因')
  })

  it('体检未通过的记录带出待补项数量——它建成了但发不了', async () => {
    rows.push(row('workflow.copilot_created', { name: 'x', ready: false, readinessIssues: 2 }))
    const [a] = await listAiActivity(ctx)
    expect(a.success).toBe(true)
    expect(a.ready).toBe(false)
    expect(a.readinessIssues).toBe(2)
  })

  it('老记录没有体检字段时 ready 为 null，不冒充通过', async () => {
    rows.push(row('workflow.copilot_created', { name: 'x' }))
    const [a] = await listAiActivity(ctx)
    expect(a.ready).toBeNull()
  })

  it('非 AI 类审计动作被过滤掉', async () => {
    rows.push(row('member.role_updated', {}))
    expect(await listAiActivity(ctx)).toHaveLength(0)
  })

  it('按对象类型筛选', async () => {
    rows.push(row('workflow.copilot_created', { name: 'w' }, 'a1'))
    rows.push(row('skill.copilot_created', { name: 's' }, 'a2'))
    const list = await listAiActivity(ctx, { object: 'skill' })
    expect(list.map((x) => x.name)).toEqual(['s'])
  })
})

describe('查询约束', () => {
  it('只查 AI 类动作，覆盖五种对象', async () => {
    await listAiActivity(ctx)
    expect(builder.in).toHaveBeenCalledWith('action', AI_ACTION_KEYS)
    const objects = new Set(AI_ACTION_KEYS.map((k) => k.split('.')[0]))
    expect(objects).toEqual(new Set(['workflow', 'agent', 'skill', 'plugin', 'schedule']))
  })

  it('onlyMine 时按 actor_id 过滤——普通成员不该看到别人的', async () => {
    await listAiActivity(ctx, { onlyMine: true })
    expect(builder.eq).toHaveBeenCalledWith('actor_id', 'u1')
  })

  it('不传 onlyMine 时不加 actor 过滤（权限由 API 层判）', async () => {
    await listAiActivity(ctx)
    expect(builder.eq).not.toHaveBeenCalled()
  })

  it('limit 上限 500，防止一次拉爆', async () => {
    await listAiActivity(ctx, { limit: 9999 })
    expect(builder.limit).toHaveBeenCalledWith(500)
  })
})
