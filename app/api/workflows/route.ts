import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listWorkflows, createWorkflow } from '@/lib/data/workflow'

// GET /api/workflows —— 列出本租户工作流（RLS 隔离，workflow:read）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const workflows = await listWorkflows(ctx)
  return Response.json({ workflows })
}

// POST /api/workflows —— 创建工作流（workflow:create，Admin/Developer）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建工作流' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  const type = body?.type === 'chatflow' ? 'chatflow' : 'workflow'
  const workflow = await createWorkflow(ctx, { name, type })
  return Response.json({ workflow }, { status: 201 })
}
