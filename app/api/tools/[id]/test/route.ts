import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { testToolVersion } from '@/lib/tools/invoke'
import { writeAudit } from '@/lib/data/audit'

// V12-4.5 / AC-01：Tool 连通性测试。
//
// 用 tool:update 而非 tool:read 鉴权：这个接口会**发起真实的出站请求**
// （打对方 API、连对方数据库），不是单纯读配置。只读权限的人不该能借它
// 把平台当跳板去探测网络。

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：测试 Tool' } }, { status: 403 })
  }

  const { id } = await params
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  const versionId = typeof b?.versionId === 'string' ? b.versionId : ''
  if (!versionId) {
    return Response.json({ error: { code: 'invalid', message: '缺少 versionId' } }, { status: 400 })
  }

  const result = await testToolVersion(ctx, versionId)

  // 审计记「测过、结果如何」，不记 detail——里面有对方响应片段与内部拓扑
  await writeAudit(ctx, 'tool.tested', 'tool', id, {
    versionId, ok: result.ok, elapsedMs: result.elapsedMs,
  })

  // 调用失败是**业务结论**不是服务端错误，仍回 200，由前端展示结论。
  // 回 5xx 会让「对方服务挂了」和「我们这边挂了」混在一起，没法排查
  return Response.json({ result })
}
