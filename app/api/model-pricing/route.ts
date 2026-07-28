import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listModelPricing, addModelPricing } from '@/lib/data/model-pricing'
import { writeAudit } from '@/lib/data/audit'

// 4.8.17c 模型定价。定价是平台级数据：读放开给已登录用户（成本展示要用），
// 写仅平台超管（与 /api/tenants 同一 isPlatformAdmin 门控）。

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  return Response.json({ pricing: await listModelPricing() })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!(await isPlatformAdmin(ctx)))
    return Response.json({ error: { code: 'forbidden', message: '仅平台超管可维护定价' } }, { status: 403 })

  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  for (const f of ['inputPer1k', 'outputPer1k'] as const) {
    if (typeof b[f] !== 'number') {
      return Response.json({ error: { code: 'invalid', message: `${f} 必须为数字` } }, { status: 400 })
    }
  }
  if (typeof b.provider !== 'string' || typeof b.model !== 'string') {
    return Response.json({ error: { code: 'invalid', message: 'provider / model 必填' } }, { status: 400 })
  }

  try {
    const price = await addModelPricing(ctx.userId, {
      provider: b.provider,
      model: b.model,
      inputPer1k: b.inputPer1k as number,
      outputPer1k: b.outputPer1k as number,
      effectiveFrom: typeof b.effectiveFrom === 'string' ? b.effectiveFrom : undefined,
      sourceNote: typeof b.sourceNote === 'string' ? b.sourceNote : null,
    })
    await writeAudit(ctx, 'pricing.added', 'model_pricing', price.id, {
      provider: price.provider, model: price.model,
      inputPer1k: price.inputPer1k, outputPer1k: price.outputPer1k,
      effectiveFrom: price.effectiveFrom,
    })
    return Response.json({ price }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '新增定价失败'
    const status = msg.includes('已有定价') ? 409 : /不能为空|必须为非负数/.test(msg) ? 400 : 500
    const code = status === 409 ? 'conflict' : status === 400 ? 'invalid' : 'server_error'
    return Response.json({ error: { code, message: msg } }, { status })
  }
}
