import { getRequestContext } from '@/lib/context'
import { can, type Action } from '@/lib/auth/permissions'
import { applyAutoFixes } from '@/lib/security/autofix'
import { scanReviewTarget } from '@/lib/data/security-scan'
import { applySecurityAutoFix } from '@/lib/data/security-scan-write'
import { writeAudit } from '@/lib/data/audit'
import { SECURITY_CHECK_CODES, type SecurityCheckCode } from '@/lib/security/scanners'

// POST /api/reviews/autofix  body: { resourceType, resourceId, codes: string[] }
// SEC-3：对可自动处理的核查项一键加固，写回资源配置并落审计。
//
// 🔴 这是**写操作**，权限与裁决同档（agent:review / skill:review）。
// 改的是别人的 Agent 配置，必须留痕：审计记下改了哪几项、改动摘要。
function reviewAction(type: string): Action {
  return type === 'skill' ? 'skill:review' : 'agent:review'
}

export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const resourceType = String(body?.resourceType ?? 'agent')
  const resourceId = String(body?.resourceId ?? '')
  if (!['agent', 'skill'].includes(resourceType)) {
    return Response.json({ error: { code: 'bad_request', message: '仅支持 agent / skill 自动处理' } }, { status: 400 })
  }
  if (!resourceId) {
    return Response.json({ error: { code: 'bad_request', message: '缺少 resourceId' } }, { status: 400 })
  }
  if (!can(ctx, reviewAction(resourceType))) {
    return Response.json({ error: { code: 'forbidden', message: '无权限执行自动处理' } }, { status: 403 })
  }

  const raw = Array.isArray(body?.codes) ? (body.codes as unknown[]) : []
  const codes = raw
    .map(String)
    .filter((c): c is SecurityCheckCode => (SECURITY_CHECK_CODES as readonly string[]).includes(c))
  if (codes.length === 0) {
    return Response.json({ error: { code: 'bad_request', message: '未选择任何可处理项' } }, { status: 400 })
  }

  const applied = await applySecurityAutoFix(ctx, resourceType as 'agent' | 'skill', resourceId, (cfg) =>
    applyAutoFixes(cfg, codes),
  )
  if (!applied) {
    return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })
  }

  if (applied.changes.length > 0) {
    await writeAudit(ctx, 'security.autofix', resourceType, resourceId, {
      codes: applied.changes.map((c) => c.code),
      // 只记变更摘要，绝不记改前改后的提示词全文——那可能含刚被替换掉的密钥
      changes: applied.changes.map((c) => c.description),
      skipped: applied.skipped,
    })
  }

  // 处理完重新扫描，让前端直接拿到最新结论，不必再发一次请求
  const rescan = await scanReviewTarget(ctx, resourceType as 'agent' | 'skill', resourceId)
  return Response.json({ changes: applied.changes, skipped: applied.skipped, scan: rescan })
}
