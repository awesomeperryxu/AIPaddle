import { getRequestContext } from '@/lib/context'
import { can, type Action } from '@/lib/auth/permissions'
import { scanReviewTarget } from '@/lib/data/security-scan'

// GET /api/reviews/scan?resourceType=agent&resourceId=xxx —— SEC-2 待审资源 AI 安全核查
// 权限与裁决同档（agent:review / skill:review）：能看到扫描详情就等于能看到别人的提示词全文，
// 不能只用 audit:read 兜——那会让审计员读到本不该读的资产配置。
function reviewAction(type: string): Action {
  return type === 'skill' ? 'skill:review' : 'agent:review'
}

export async function GET(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const url = new URL(req.url)
  const resourceType = url.searchParams.get('resourceType') ?? 'agent'
  const resourceId = url.searchParams.get('resourceId') ?? ''
  if (!['agent', 'skill', 'workflow'].includes(resourceType)) {
    return Response.json({ error: { code: 'bad_request', message: '非法 resourceType' } }, { status: 400 })
  }
  if (!resourceId) {
    return Response.json({ error: { code: 'bad_request', message: '缺少 resourceId' } }, { status: 400 })
  }
  if (!can(ctx, reviewAction(resourceType))) {
    return Response.json({ error: { code: 'forbidden', message: '无权限查看安全核查' } }, { status: 403 })
  }

  const result = await scanReviewTarget(ctx, resourceType as 'agent' | 'skill' | 'workflow', resourceId)
  if (!result) {
    // null = 资源不存在/无权访问，或该类型暂不支持扫描（workflow）。两者都不该给 500
    return Response.json({ scan: null, reason: resourceType === 'workflow' ? 'unsupported' : 'not_found' })
  }
  return Response.json({ scan: result })
}
