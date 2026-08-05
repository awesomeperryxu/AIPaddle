import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listApiKeysWithExtension, createApiKey, API_KEY_SCOPES, type ApiKeyScope } from '@/lib/data/api-keys'
import { getTenantName } from '@/lib/data/tenant'
import { writeAudit } from '@/lib/data/audit'

// 4.8.6：对外 API Key 管理。权限 apikey:manage（Admin）。明文只在 POST 时一次性返回。

function isScope(v: unknown): v is ApiKeyScope {
  return typeof v === 'string' && (API_KEY_SCOPES as readonly string[]).includes(v)
}

// GET /api/keys —— 本租户 Key 清单（脱敏，只回前缀+掩码；Key-1 起附带所属扩展名）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'apikey:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理 API Key' } }, { status: 403 })
  }
  // orgName 仅用于页头标注「这些 Key 属于哪家租户」，避免多租户切换时张冠李戴
  const [keys, orgName] = await Promise.all([listApiKeysWithExtension(ctx), getTenantName(ctx)])
  return Response.json({ keys, orgName })
}

// POST /api/keys —— 签发 Key。响应含 key 明文（仅此一次），请立即复制保存。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'apikey:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理 API Key' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  const scope: ApiKeyScope = isScope(body?.scope) ? body.scope : 'agent'

  const { key, masked } = await createApiKey(ctx, { name, scope })
  await writeAudit(ctx, 'apikey.created', 'api_key', masked.id, { name, scope })
  // key = 明文，仅此一次返回；后续列表只回脱敏前缀。
  return Response.json({ key, apiKey: masked }, { status: 201 })
}
