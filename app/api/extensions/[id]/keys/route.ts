import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listApiKeys, createApiKey } from '@/lib/data/api-keys'
import { getExtensionById } from '@/lib/data/extensions'
import { writeAudit } from '@/lib/data/audit'

// V12-8.10：某 Extension 的 Key 管理。
// 🔴 明文仅在签发响应里返回**这一次**，此后无法找回；绝不写审计 detail、绝不落日志。
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:key:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理扩展密钥' } }, { status: 403 })
  }
  const { id } = await params
  const all = await listApiKeys(ctx)
  return Response.json({ keys: all.filter((k) => k.extensionId === id) })
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'ext:key:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理扩展密钥' } }, { status: 403 })
  }
  const { id } = await params
  // 目标 Extension 必须属于本租户——否则等于给别家签 Key
  const ext = await getExtensionById(ctx, id)
  if (!ext) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const name = String(b?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: 'Key 名称不能为空' } }, { status: 400 })

  const { key: plaintext, masked } = await createApiKey(ctx, {
    name,
    scope: 'agent',
    extensionId: id,
    scopes: Array.isArray(b?.scopes) ? (b.scopes as string[]) : ['chat'],
    expiresAt: typeof b?.expiresAt === 'string' ? b.expiresAt : null,
  })
  // 🔴 detail 只记可识别信息，绝不含明文或哈希
  await writeAudit(ctx, 'extension.key_issued', 'extension', id, {
    keyId: masked.id, name: masked.name, keyPrefix: masked.keyPrefix,
  })
  // plaintext 仅此一次返回，前端必须提示用户立即保存
  return Response.json({ key: masked, plaintext }, { status: 201 })
}
