/**
 * L2 单元测试 · 4.8.14a 组织架构数据层
 * 覆盖：树装配 / 层级深度与成环纯函数 / createDepartment 与 updateDepartment 的
 * 层级·成环·同名校验 / deleteDepartment 非空拒绝 / 审计留痕。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))

type Row = {
  id: string
  parent_id: string | null
  name: string
  leader_id: string | null
  cost_center: string | null
  status: 'active' | 'frozen' | 'revoked'
  sort_order: number
}

// 可变 mock 状态：departments 行集 / users 行集 / insert 时是否抛唯一约束冲突
const state = vi.hoisted(() => ({
  rows: [] as Row[],
  members: [] as { id: string; department_id: string | null }[],
  insertConflict: false,
}))

vi.mock('@/lib/supabase/server', () => {
  const chain = (table: string) => {
    const p: Record<string, unknown> = {}
    let isWrite = false
    for (const m of ['select', 'eq', 'is', 'order']) p[m] = () => p
    p.update = () => { isWrite = true; return p }
    p.insert = () => { isWrite = true; return p }
    p.single = async () => {
      if (state.insertConflict) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      return {
        data: {
          id: 'new-dept', parent_id: null, name: '新部门',
          leader_id: null, cost_center: null, status: 'active', sort_order: 0,
        },
        error: null,
      }
    }
    p.then = (resolve: (v: unknown) => void) => {
      if (isWrite) return resolve({ data: null, error: null })
      if (table === 'departments') return resolve({ data: state.rows, error: null })
      if (table === 'users') return resolve({ data: state.members, error: null })
      return resolve({ data: [], error: null })
    }
    return p
  }
  return { createClient: vi.fn().mockResolvedValue({ from: (t: string) => chain(t) }) }
})

import {
  buildTree, depthOf, wouldCycle, subtreeHeight, MAX_DEPTH,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  type Department,
} from '@/lib/data/departments'
import { writeAudit } from '@/lib/data/audit'

const ctx = { userId: 'admin-1', orgId: 'org1', roles: ['Admin'] } as never
const mockAudit = vi.mocked(writeAudit)

const row = (id: string, parent: string | null, name = id, sort = 0): Row => ({
  id, parent_id: parent, name, leader_id: null, cost_center: null, status: 'active', sort_order: sort,
})

const dept = (id: string, parentId: string | null, sortOrder = 0): Department => ({
  id, parentId, name: id, leaderId: null, costCenter: null,
  status: 'active', sortOrder, memberCount: 0,
})

// ──────────────────────────────────────────────────────────────────────────────
describe('树装配与层级纯函数', () => {
  it('buildTree 按 parentId 组装并按 sortOrder 排序', () => {
    const tree = buildTree([dept('b', null, 2), dept('a', null, 1), dept('a1', 'a')])
    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['a1'])
  })

  it('父级缺失的孤儿节点挂到根，不整枝消失', () => {
    const tree = buildTree([dept('orphan', 'gone')])
    expect(tree.map((n) => n.id)).toEqual(['orphan'])
  })

  it('depthOf：根为 1，逐级递增', () => {
    const parentOf = new Map<string, string | null>([['a', null], ['a1', 'a'], ['a11', 'a1']])
    expect(depthOf('a', parentOf)).toBe(1)
    expect(depthOf('a11', parentOf)).toBe(3)
  })

  it('wouldCycle：移到自己或自己的后代之下 → true', () => {
    const parentOf = new Map<string, string | null>([['a', null], ['a1', 'a'], ['a11', 'a1']])
    expect(wouldCycle('a', 'a', parentOf)).toBe(true)
    expect(wouldCycle('a', 'a11', parentOf)).toBe(true)
    expect(wouldCycle('a11', null, parentOf)).toBe(false)
  })

  it('subtreeHeight：叶子为 1，含两层子树为 3', () => {
    const childrenOf = new Map<string, string[]>([['a', ['a1']], ['a1', ['a11']]])
    expect(subtreeHeight('a11', childrenOf)).toBe(1)
    expect(subtreeHeight('a', childrenOf)).toBe(3)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('listDepartments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.rows = [row('a', null), row('b', null)]
    state.members = [
      { id: 'u1', department_id: 'a' },
      { id: 'u2', department_id: 'a' },
      { id: 'u3', department_id: null },
    ]
  })

  it('带出各部门直属成员数', async () => {
    const list = await listDepartments(ctx)
    expect(list.find((d) => d.id === 'a')?.memberCount).toBe(2)
    expect(list.find((d) => d.id === 'b')?.memberCount).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('createDepartment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.insertConflict = false
    state.rows = [row('l1', null), row('l2', 'l1'), row('l3', 'l2'), row('l4', 'l3'), row('l5', 'l4')]
    state.members = []
  })

  it('名称为空 → 拒绝', async () => {
    await expect(createDepartment(ctx, { name: '  ' })).rejects.toThrow('部门名称不能为空')
  })

  it('名称超长（>50）→ 拒绝', async () => {
    await expect(createDepartment(ctx, { name: '部'.repeat(51) })).rejects.toThrow('不能超过 50 字')
  })

  it('上级部门不存在 → 拒绝', async () => {
    await expect(createDepartment(ctx, { name: '研发部', parentId: 'ghost' }))
      .rejects.toThrow('上级部门不存在或无权限')
  })

  it(`挂在第 ${MAX_DEPTH} 级下 → 超层级被拒`, async () => {
    await expect(createDepartment(ctx, { name: '第六级', parentId: 'l5' }))
      .rejects.toThrow(`部门层级不能超过 ${MAX_DEPTH} 级`)
  })

  it('挂在第 4 级下 → 允许，并写 department.created 审计', async () => {
    const d = await createDepartment(ctx, { name: '第五级', parentId: 'l4' })
    expect(d.id).toBe('new-dept')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'department.created', 'department', 'new-dept', {
      name: '第五级', parentId: 'l4',
    })
  })

  it('同级同名（唯一索引 23505）→ 中文提示', async () => {
    state.insertConflict = true
    await expect(createDepartment(ctx, { name: '研发部' })).rejects.toThrow('同级已存在同名部门')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('updateDepartment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.insertConflict = false
    // a → a1 → a11；另有 l1..l4 四级链用于深度测试
    state.rows = [
      row('a', null), row('a1', 'a'), row('a11', 'a1'),
      row('l1', null), row('l2', 'l1'), row('l3', 'l2'), row('l4', 'l3'),
    ]
    state.members = []
  })

  it('部门不存在 → 404 语义错误', async () => {
    await expect(updateDepartment(ctx, 'ghost', { name: 'x' })).rejects.toThrow('部门不存在或无权限')
  })

  it('移动到自己的下级 → 成环被拒', async () => {
    await expect(updateDepartment(ctx, 'a', { parentId: 'a11' }))
      .rejects.toThrow('不能把部门移动到自己或其下级之下')
  })

  it('移动后子树整体超过层级上限 → 被拒', async () => {
    // a 子树高 3，挂到第 3 级 l3 下会到第 6 级
    await expect(updateDepartment(ctx, 'a', { parentId: 'l3' }))
      .rejects.toThrow(`部门层级不能超过 ${MAX_DEPTH} 级`)
  })

  it('移动到合法位置 → 通过并写 department.updated 审计', async () => {
    await updateDepartment(ctx, 'a', { parentId: 'l2' })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'department.updated', 'department', 'a', { parentId: 'l2' })
  })

  it('parentId 传 null → 提升为顶级部门', async () => {
    await updateDepartment(ctx, 'a11', { parentId: null })
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'department.updated', 'department', 'a11', { parentId: null })
  })

  it('无任何字段 → 不写库不写审计', async () => {
    await updateDepartment(ctx, 'a', {})
    expect(mockAudit).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('deleteDepartment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.rows = [row('a', null), row('a1', 'a'), row('solo', null)]
    state.members = []
  })

  it('还有子部门 → 拒绝', async () => {
    await expect(deleteDepartment(ctx, 'a')).rejects.toThrow('该部门下还有子部门')
  })

  it('还有成员 → 拒绝', async () => {
    state.members = [{ id: 'u1', department_id: 'solo' }]
    await expect(deleteDepartment(ctx, 'solo')).rejects.toThrow('该部门下还有成员')
  })

  it('空部门 → 软删成功并写 department.deleted 审计', async () => {
    await deleteDepartment(ctx, 'solo')
    expect(mockAudit).toHaveBeenCalledWith(ctx, 'department.deleted', 'department', 'solo', { name: 'solo' })
  })
})
