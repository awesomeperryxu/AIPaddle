import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { updateDepartment, deleteDepartment, type DepartmentStatus } from '@/lib/data/departments'
import { departmentFail as fail } from '@/lib/api/errors'

const STATUSES: DepartmentStatus[] = ['active', 'frozen', 'revoked']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'department:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理部门' } }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  const input: Parameters<typeof updateDepartment>[2] = {}
  if ('name' in body) {
    if (typeof body.name !== 'string') {
      return Response.json({ error: { code: 'invalid', message: '部门名称无效' } }, { status: 400 })
    }
    input.name = body.name
  }
  // parentId 显式传 null = 提升为顶级部门
  if ('parentId' in body) {
    if (body.parentId !== null && typeof body.parentId !== 'string') {
      return Response.json({ error: { code: 'invalid', message: '上级部门无效' } }, { status: 400 })
    }
    input.parentId = body.parentId as string | null
  }
  if ('leaderId' in body) {
    if (body.leaderId !== null && typeof body.leaderId !== 'string') {
      return Response.json({ error: { code: 'invalid', message: '负责人无效' } }, { status: 400 })
    }
    input.leaderId = body.leaderId as string | null
  }
  if ('costCenter' in body) {
    if (body.costCenter !== null && typeof body.costCenter !== 'string') {
      return Response.json({ error: { code: 'invalid', message: '成本中心无效' } }, { status: 400 })
    }
    input.costCenter = body.costCenter as string | null
  }
  if ('status' in body) {
    if (!STATUSES.includes(body.status as DepartmentStatus)) {
      return Response.json({ error: { code: 'invalid', message: '部门状态无效' } }, { status: 400 })
    }
    input.status = body.status as DepartmentStatus
  }

  try {
    await updateDepartment(ctx, id, input)
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '更新失败')
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'department:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理部门' } }, { status: 403 })

  const { id } = await params
  try {
    await deleteDepartment(ctx, id)
    return Response.json({ ok: true })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '删除失败')
  }
}
