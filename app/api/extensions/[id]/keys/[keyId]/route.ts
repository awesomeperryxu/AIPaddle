import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { revokeApiKey } from '@/lib/data/api-keys'
import { writeAudit } from '@/lib/data/audit'

// V12-8.10：撤销 Key。置 revoked_at 不删行——删掉就查不出这个 Key 曾调过什么。
type Ctx = { params: Promise<{ id: string; keyId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:key:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理扩展密钥' } }, { status: 403 })
  }
  const { id, keyId } = await params
  const ok = await revokeApiKey(ctx, keyId)
  if (!ok) return Response.json({ error: { code: 'not_found', message: '不存在或已撤销' } }, { status: 404 })
  await writeAudit(ctx, 'extension.key_revoked', 'extension', id, { keyId })
  return Response.json({ ok: true })
}
