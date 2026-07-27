import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { revokeApiKey } from '@/lib/data/api-keys'
import { writeAudit } from '@/lib/data/audit'

// 4.8.6：吊销 API Key。权限 apikey:manage（Admin）。

type Ctx = { params: Promise<{ id: string }> }

// DELETE /api/keys/[id] —— 吊销（软吊销，置 revoked_at）。
export async function DELETE(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'apikey:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理 API Key' } }, { status: 403 })
  }
  const { id } = await params
  const ok = await revokeApiKey(ctx, id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: 'Key 不存在或已吊销' } }, { status: 404 })
  await writeAudit(ctx, 'apikey.revoked', 'api_key', id, {})
  return Response.json({ ok: true })
}
