import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { updateProvider, deleteProvider } from '@/lib/data/model-providers'

// ADR-016 4.7.3：单个供应商编辑 / 软删除。权限 provider:manage。
// 跨租户/不存在的 id 由 RLS + deleted_at 过滤保证只作用于本租户在册行（静默 no-op，不泄露存在性）。

type Ctx = { params: Promise<{ id: string }> }

function toStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined
}

// PATCH /api/model-providers/[id] —— 编辑；apiKey 传入才重新加密覆盖，不传保留原 Key。
export async function PATCH(request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  const patch: Parameters<typeof updateProvider>[2] = {}
  if (typeof body?.credentialName === 'string') {
    const name = body.credentialName.trim()
    if (!name) return Response.json({ error: { code: 'invalid', message: '凭证名称不能为空' } }, { status: 400 })
    patch.credentialName = name
  }
  if ('baseUrl' in body) {
    patch.baseUrl = typeof body.baseUrl === 'string' && body.baseUrl.trim() ? body.baseUrl.trim() : null
  }
  if (typeof body?.apiKey === 'string' && body.apiKey !== '') patch.apiKey = body.apiKey
  if (body?.models !== undefined) patch.models = toStringArray(body.models)
  if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled

  try {
    await updateProvider(ctx, id, patch)
    return Response.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '更新供应商失败'
    return Response.json({ error: { code: 'conflict', message } }, { status: 409 })
  }
}

// DELETE /api/model-providers/[id] —— 软删除（deleted_at 置位）。
export async function DELETE(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const { id } = await params
  await deleteProvider(ctx, id)
  return Response.json({ ok: true })
}
