import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { restoreWorkflowVersion } from '@/lib/data/workflow'

type Ctx = { params: Promise<{ id: string; version: string }> }

// POST /api/workflows/[id]/versions/[version]/restore —— 回滚到指定版本（4.4.10）。workflow:update。
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：回滚工作流版本' } }, { status: 403 })
  }
  const { id, version: versionRaw } = await params
  const version = Number(versionRaw)
  if (!Number.isInteger(version) || version < 0) {
    return Response.json({ error: { code: 'bad_request', message: '非法版本号' } }, { status: 400 })
  }
  const workflow = await restoreWorkflowVersion(ctx, id, version)
  if (!workflow) return Response.json({ error: { code: 'not_found', message: '版本不存在或无权访问' } }, { status: 404 })
  return Response.json({ workflow })
}
