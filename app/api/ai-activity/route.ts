import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listAiActivity, type AiActivityObject } from '@/lib/data/ai-activity'

const OBJECTS = ['workflow', 'agent', 'skill', 'plugin', 'schedule'] as const

// GET /api/ai-activity —— AI 操作记录（WF-16）。可选 query: limit / object / scope=all
//
// 权限分层：默认只返回自己的记录（人人可看自己的）；
// scope=all 看全租户，需要 audit:read（Admin/Auditor）——与安全中心同一把尺子，
// 不能让普通成员靠这个页面绕过审计权限看别人的操作。
export async function GET(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const url = new URL(req.url)
  const wantAll = url.searchParams.get('scope') === 'all'
  if (wantAll && !can(ctx, 'audit:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限查看全租户记录' } }, { status: 403 })
  }
  const limitRaw = Number(url.searchParams.get('limit'))
  const objectRaw = url.searchParams.get('object')
  const object = OBJECTS.includes(objectRaw as AiActivityObject) ? (objectRaw as AiActivityObject) : undefined

  const items = await listAiActivity(ctx, {
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
    onlyMine: !wantAll,
    object,
  })
  return Response.json({ items, scope: wantAll ? 'all' : 'mine', canViewAll: can(ctx, 'audit:read') })
}
