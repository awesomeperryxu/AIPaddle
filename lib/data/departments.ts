import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/data/audit'

// PRD 2.10.1：建议层级不超过 5 级
export const MAX_DEPTH = 5

export type DepartmentStatus = 'active' | 'frozen' | 'revoked'

export interface Department {
  id: string
  parentId: string | null
  name: string
  leaderId: string | null
  costCenter: string | null
  status: DepartmentStatus
  sortOrder: number
  memberCount: number
}

/** 树节点：children 由 buildTree 组装，前端左树直接消费 */
export interface DepartmentNode extends Department {
  children: DepartmentNode[]
}

type DeptRow = {
  id: string
  parent_id: string | null
  name: string
  leader_id: string | null
  cost_center: string | null
  status: DepartmentStatus
  sort_order: number
}

function mapRow(r: DeptRow, memberCount = 0): Department {
  return {
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    leaderId: r.leader_id,
    costCenter: r.cost_center,
    status: r.status,
    sortOrder: r.sort_order,
    memberCount,
  }
}

/** 扁平列表 → 树。孤儿节点（父级被软删）挂到根，避免整枝消失。 */
export function buildTree(items: Department[]): DepartmentNode[] {
  const byId = new Map<string, DepartmentNode>()
  for (const d of items) byId.set(d.id, { ...d, children: [] })

  const roots: DepartmentNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: DepartmentNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh'))
    for (const n of list) sort(n.children)
  }
  sort(roots)
  return roots
}

/** 层级深度：根为 1。用于 MAX_DEPTH 校验。 */
export function depthOf(id: string | null, parentOf: Map<string, string | null>): number {
  let depth = 1
  let cur = id
  const seen = new Set<string>()
  while (cur) {
    if (seen.has(cur)) break // 已成环，交由 wouldCycle 拒绝
    seen.add(cur)
    cur = parentOf.get(cur) ?? null
    if (cur) depth++
  }
  return depth
}

/** 把 nodeId 挂到 newParentId 下是否成环（新父级是自己或自己的后代） */
export function wouldCycle(
  nodeId: string,
  newParentId: string | null,
  parentOf: Map<string, string | null>,
): boolean {
  let cur = newParentId
  const seen = new Set<string>()
  while (cur) {
    if (cur === nodeId) return true
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = parentOf.get(cur) ?? null
  }
  return false
}

/** 子树中最深的一层相对本节点的深度（本节点算 1） */
export function subtreeHeight(nodeId: string, childrenOf: Map<string, string[]>): number {
  const kids = childrenOf.get(nodeId) ?? []
  if (kids.length === 0) return 1
  return 1 + Math.max(...kids.map((k) => subtreeHeight(k, childrenOf)))
}

async function loadRows(ctx: RequestContext): Promise<DeptRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id,parent_id,name,leader_id,cost_center,status,sort_order')
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data as DeptRow[] | null) ?? []
}

/** 本租户全部部门（扁平），带各部门直属成员数 */
export async function listDepartments(ctx: RequestContext): Promise<Department[]> {
  const supabase = await createClient()
  const rows = await loadRows(ctx)

  const { data: members, error: mErr } = await supabase
    .from('users')
    .select('department_id')
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
  if (mErr) throw new Error(mErr.message)

  const counts = new Map<string, number>()
  for (const m of (members as { department_id: string | null }[] | null) ?? []) {
    if (m.department_id) counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1)
  }
  return rows.map((r) => mapRow(r, counts.get(r.id) ?? 0))
}

export async function listDepartmentTree(ctx: RequestContext): Promise<DepartmentNode[]> {
  return buildTree(await listDepartments(ctx))
}

function assertName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('部门名称不能为空')
  if (trimmed.length > 50) throw new Error('部门名称不能超过 50 字')
  return trimmed
}

export async function createDepartment(
  ctx: RequestContext,
  input: { name: string; parentId?: string | null; leaderId?: string | null; costCenter?: string | null },
): Promise<Department> {
  const name = assertName(input.name)
  const rows = await loadRows(ctx)
  const parentOf = new Map(rows.map((r) => [r.id, r.parent_id]))

  const parentId = input.parentId ?? null
  if (parentId) {
    if (!parentOf.has(parentId)) throw new Error('上级部门不存在或无权限')
    if (depthOf(parentId, parentOf) + 1 > MAX_DEPTH) {
      throw new Error(`部门层级不能超过 ${MAX_DEPTH} 级`)
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .insert({
      org_id: ctx.orgId,
      name,
      parent_id: parentId,
      leader_id: input.leaderId ?? null,
      cost_center: input.costCenter ?? null,
    })
    .select('id,parent_id,name,leader_id,cost_center,status,sort_order')
    .single()
  if (error) {
    // 唯一索引 uq_departments_sibling_name
    if (error.code === '23505') throw new Error('同级已存在同名部门')
    throw new Error(error.message)
  }

  const dept = mapRow(data as DeptRow)
  await writeAudit(ctx, 'department.created', 'department', dept.id, { name, parentId })
  return dept
}

export async function updateDepartment(
  ctx: RequestContext,
  id: string,
  input: {
    name?: string
    parentId?: string | null
    leaderId?: string | null
    costCenter?: string | null
    status?: DepartmentStatus
  },
): Promise<void> {
  const rows = await loadRows(ctx)
  const target = rows.find((r) => r.id === id)
  if (!target) throw new Error('部门不存在或无权限')

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = assertName(input.name)
  if (input.leaderId !== undefined) patch.leader_id = input.leaderId
  if (input.costCenter !== undefined) patch.cost_center = input.costCenter || null
  if (input.status !== undefined) patch.status = input.status

  // 移动节点：成环 + 深度双校验（子树整体下移后仍不得超过 MAX_DEPTH）
  if (input.parentId !== undefined && input.parentId !== target.parent_id) {
    const parentOf = new Map(rows.map((r) => [r.id, r.parent_id]))
    const childrenOf = new Map<string, string[]>()
    for (const r of rows) {
      if (!r.parent_id) continue
      childrenOf.set(r.parent_id, [...(childrenOf.get(r.parent_id) ?? []), r.id])
    }

    const newParent = input.parentId
    if (newParent) {
      if (!parentOf.has(newParent)) throw new Error('上级部门不存在或无权限')
      if (wouldCycle(id, newParent, parentOf)) throw new Error('不能把部门移动到自己或其下级之下')
      if (depthOf(newParent, parentOf) + subtreeHeight(id, childrenOf) > MAX_DEPTH) {
        throw new Error(`部门层级不能超过 ${MAX_DEPTH} 级`)
      }
    }
    patch.parent_id = newParent
  }

  if (Object.keys(patch).length === 0) return

  patch.updated_at = new Date().toISOString()
  const supabase = await createClient()
  const { error } = await supabase
    .from('departments')
    .update(patch)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
  if (error) {
    if (error.code === '23505') throw new Error('同级已存在同名部门')
    throw new Error(error.message)
  }

  await writeAudit(ctx, 'department.updated', 'department', id, input as Record<string, unknown>)
}

/**
 * 软删部门。非空部门（有子部门或有成员）默认拒绝，避免把成员甩成孤儿；
 * 需要先把子部门与成员转移走再删。
 */
export async function deleteDepartment(ctx: RequestContext, id: string): Promise<void> {
  const rows = await loadRows(ctx)
  const target = rows.find((r) => r.id === id)
  if (!target) throw new Error('部门不存在或无权限')

  if (rows.some((r) => r.parent_id === id)) {
    throw new Error('该部门下还有子部门，请先移除或转移')
  }

  const supabase = await createClient()
  const { data: members, error: mErr } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('department_id', id)
    .is('deleted_at', null)
  if (mErr) throw new Error(mErr.message)
  if (((members as { id: string }[] | null) ?? []).length > 0) {
    throw new Error('该部门下还有成员，请先转移成员')
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('departments')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
  if (error) throw new Error(error.message)

  await writeAudit(ctx, 'department.deleted', 'department', id, { name: target.name })
}
