import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getTenantDefaultModel, setTenantDefaultModel } from '@/lib/data/tenant'
import { AGENT_MODELS } from '@/lib/agents/config'

// 以租户为单位的默认模型（ADR-007 复用 tenant:read / tenant:manage，不新造 action）。
// GET：Admin/Auditor 可读；PATCH：仅 Admin 可改。模型值服务端校验（不信前端）。

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can(ctx, 'tenant:read')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const model = await getTenantDefaultModel(ctx)
  return Response.json({ model, options: AGENT_MODELS })
}

export async function PATCH(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can(ctx, 'tenant:manage')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { model?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const model = body.model
  if (typeof model !== 'string' || !AGENT_MODELS.some((m) => m.value === model)) {
    return Response.json({ error: '非法模型' }, { status: 400 })
  }

  await setTenantDefaultModel(ctx, model)
  return Response.json({ model })
}
