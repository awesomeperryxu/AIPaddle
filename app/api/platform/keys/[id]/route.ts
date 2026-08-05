import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { revokeAnyApiKey } from '@/lib/data/platform-keys'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/platform/keys/[id] —— 跨租户吊销 Key。Key-2，仅平台超管。
// 吊销别家租户的凭证是高影响操作，必须留审计；detail 只记可识别信息，绝不含明文/哈希。
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可访问' } }, { status: 403 })

  const { id } = await params
  const revoked = await revokeAnyApiKey(id)
  if (!revoked) return Response.json({ error: { code: 'not_found', message: '不存在或已吊销' } }, { status: 404 })

  await writeAudit(ctx, 'apikey.revoked_by_platform', 'api_key', id, {
    keyId: revoked.id, name: revoked.name, keyPrefix: revoked.keyPrefix,
    targetOrgId: revoked.orgId, targetOrgName: revoked.orgName,
    extensionName: revoked.extensionName,
  })
  return Response.json({ key: revoked })
}
