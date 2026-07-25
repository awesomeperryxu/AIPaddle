/**
 * 4.1.18 / ADR-014：数字员工子 Agent 绑定校验
 */
import { describe, it, expect } from 'vitest'
import { isDigitalEmployee, validateSubAgents } from '@/lib/agents/digital-employee'

describe('数字员工', () => {
  it('isDigitalEmployee：引用了子 Agent 即数字员工', () => {
    expect(isDigitalEmployee(['a'])).toBe(true)
    expect(isDigitalEmployee([])).toBe(false)
  })

  it('validateSubAgents：自引/无权/本身是数字员工 被拒，其余接受并去重', () => {
    const r = validateSubAgents({
      selfId: 'self',
      candidateIds: ['self', 'noperm', 'de', 'ok', 'ok'],
      authorizedIds: new Set(['de', 'ok']),
      digitalEmployeeIds: new Set(['de']),
    })
    expect(r.accepted).toEqual(['ok']) // 去重 + 仅授权且非数字员工
    const reasons = Object.fromEntries(r.rejected.map((x) => [x.id, x.reason]))
    expect(reasons['self']).toMatch(/自己/)
    expect(reasons['noperm']).toMatch(/无权/)
    expect(reasons['de']).toMatch(/嵌套/)
  })

  it('空候选 → 空结果', () => {
    const r = validateSubAgents({ selfId: 's', candidateIds: [], authorizedIds: new Set(), digitalEmployeeIds: new Set() })
    expect(r.accepted).toEqual([])
    expect(r.rejected).toEqual([])
  })
})
