/**
 * L2 测试 · DE-6 数字员工可用性体检
 *
 * 这层要挡的是「自身 published、下级却跑不了」——线上 19 个数字员工里有 16 个
 * 处于这个状态（65 行 agent_resources 指向已删除的 Agent），而页面一路显示已发布。
 * 所以每条判定都必须钉死，尤其是 error 与 warn 的分界：
 * 分错一边，要么该拦的没拦，要么把审核流程锁死。
 */
import { describe, it, expect } from 'vitest'
import { checkDigitalEmployee, summarizeDeReadiness, type SubAgentState } from '@/lib/agents/de-readiness'

const sub = (id: string, name: string, status: SubAgentState['status']): SubAgentState =>
  ({ id, name, status })

describe('下级全部已发布 → ready', () => {
  it('两个 published 下级无任何 issue', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'published'), sub('a2', '律守正', 'published')])
    expect(r.ready).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.checked).toBe(2)
  })
})

describe('error：会真正拦住发布的情况', () => {
  it('下级是草稿 → error', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'draft')])
    expect(r.ready).toBe(false)
    expect(r.issues[0].level).toBe('error')
    expect(r.issues[0].code).toBe('sub_agent_unpublished')
    expect(r.issues[0].message).toContain('文博凯')
    expect(r.issues[0].message).toContain('草稿')
  })

  it('下级已下线 → error', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'offline')])
    expect(r.ready).toBe(false)
    expect(r.issues[0].level).toBe('error')
  })

  it('下级已被删除 → error，且带上 id（页面上连名字都没有，不报就没人发现）', () => {
    const r = checkDigitalEmployee([], ['gone-1'])
    expect(r.ready).toBe(false)
    expect(r.issues[0].code).toBe('sub_agent_missing')
    expect(r.issues[0].subAgentId).toBe('gone-1')
  })

  it('一个可用 + 一个草稿 → 仍然拦住（不能因为"大部分能跑"就放行）', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'published'), sub('a2', '律守正', 'draft')])
    expect(r.ready).toBe(false)
    expect(r.issues.filter(i => i.level === 'error')).toHaveLength(1)
  })
})

describe('warn：提示但不拦', () => {
  it('🔴 下级待审核 → warn 而非 error', () => {
    // 拦住会让审核流程互相死锁：上级等下级发布、下级等审核。
    // 待审核是过程态，不是坏状态。
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'pending')])
    expect(r.ready).toBe(true)
    expect(r.issues[0].level).toBe('warn')
    expect(r.issues[0].code).toBe('sub_agent_pending')
  })

  it('数字员工一个下级都没有 → warn（等同普通 Agent，仍能对话）', () => {
    const r = checkDigitalEmployee([], [], true)
    expect(r.ready).toBe(true)
    expect(r.issues[0].code).toBe('no_sub_agent')
  })

  it('普通 Agent 没有下级 → 不该报「没有下级」', () => {
    const r = checkDigitalEmployee([], [], false)
    expect(r.issues).toHaveLength(0)
    expect(r.ready).toBe(true)
  })
})

describe('summarize：错误信息要指出具体是哪一个', () => {
  it('列出失效下级的名字', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'draft'), sub('a2', '律守正', 'offline')])
    const s = summarizeDeReadiness(r)
    expect(s).toContain('文博凯')
    expect(s).toContain('律守正')
    expect(s).toContain('2 个')
  })

  it('全部可用时说全部可用', () => {
    const r = checkDigitalEmployee([sub('a1', '文博凯', 'published')])
    expect(summarizeDeReadiness(r)).toBe('全部下级可用')
  })

  it('超过 5 个只列前 5 个并标「等」，不刷屏', () => {
    const many = Array.from({ length: 7 }, (_, i) => sub(`a${i}`, `员工${i}`, 'draft'))
    const s = summarizeDeReadiness(checkDigitalEmployee(many))
    expect(s).toContain('7 个')
    expect(s).toContain('等')
  })
})

describe('线上真实场景复现', () => {
  it('自身 published + 29 个下级中 1 个已删除 → 必须拦住（汽车行业内容创作专家团）', () => {
    const subs = Array.from({ length: 29 }, (_, i) => sub(`a${i}`, `专家${i}`, 'published'))
    const r = checkDigitalEmployee(subs, ['deleted-1'])
    expect(r.ready).toBe(false)
    expect(r.checked).toBe(30)
    expect(r.issues.filter(i => i.code === 'sub_agent_missing')).toHaveLength(1)
  })
})
