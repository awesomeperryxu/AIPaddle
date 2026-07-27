import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listDepartments, listDepartmentTree, createDepartment } from '@/lib/data/departments'
import { departmentFail as fail } from '@/lib/api/errors'

export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'department:read'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看部门' } }, { status: 403 })

  const flat = new URL(request.url).searchParams.get('flat') === '1'
  try {
    return flat
      ? Response.json({ departments: await listDepartments(ctx) })
      : Response.json({ departments: await listDepartmentTree(ctx) })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '查询失败')
  }
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'department:manage'))
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理部门' } }, { status: 403 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: { code: 'invalid', message: '部门名称不能为空' } }, { status: 400 })
  }

  try {
    const dept = await createDepartment(ctx, {
      name: body.name,
      parentId: typeof body.parentId === 'string' ? body.parentId : null,
      leaderId: typeof body.leaderId === 'string' ? body.leaderId : null,
      costCenter: typeof body.costCenter === 'string' ? body.costCenter : null,
    })
    return Response.json({ department: dept }, { status: 201 })
  } catch (e) {
    return fail(e instanceof Error ? e.message : '创建失败')
  }
}
