import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllApiKeys } from '@/lib/data/platform-keys'

// GET /api/platform/keys —— 全平台 Key 清单（跨租户，脱敏）。
// Key-2：仅平台超管（ADR-010，与 /api/platform/tenant-usage 同一 isPlatformAdmin 门控）。
// 🔴 租户 Admin 走 /api/keys 只看本租户；本路由**不**接受角色授权，只认 platform_admins。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可访问' } }, { status: 403 })

  const keys = await listAllApiKeys()
  return Response.json({ keys })
}
