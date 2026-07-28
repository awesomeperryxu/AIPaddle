import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { deleteModelPricing } from '@/lib/data/model-pricing'
import { writeAudit } from '@/lib/data/audit'

// DELETE /api/model-pricing/[id] —— 软删一档定价（仅平台超管，4.8.17c）。
// 注意：删的是某个历史价位档，不影响同一模型更早/更晚的档；成本仍按调用当时生效的档算。
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可维护定价' } }, { status: 403 })

  const { id } = await params
  const ok = await deleteModelPricing(id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: '定价不存在或已删除' } }, { status: 404 })
  await writeAudit(ctx, 'pricing.deleted', 'model_pricing', id, {})
  return Response.json({ ok: true })
}
