import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  getModelSettings,
  setModelSettings,
  type ModelSettings,
  type ModelSlot,
} from '@/lib/data/model-providers'

// ADR-016 4.7.3：租户默认系统模型 5 槽（llm/embedding/rerank/stt/tts）。权限 provider:manage。
// 静态段 settings 在 Next 路由匹配上优先于 [id]，不与单资源路由冲突。

const SLOT_KEYS = ['llm', 'embedding', 'rerank', 'stt', 'tts'] as const
type SlotKey = (typeof SLOT_KEYS)[number]

function parseSlot(v: unknown): ModelSlot | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const providerId = typeof o.providerId === 'string' ? o.providerId.trim() : ''
  const model = typeof o.model === 'string' ? o.model.trim() : ''
  if (!providerId || !model) return null
  return { providerId, model }
}

// GET /api/model-providers/settings —— 读本租户默认模型设置。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const settings = await getModelSettings(ctx)
  return Response.json({ settings })
}

// PUT /api/model-providers/settings —— 整体覆盖默认模型设置（只接受合法槽，非法整体拒绝）。
export async function PUT(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const raw = (body?.settings ?? body) as Record<string, unknown>
  if (!raw || typeof raw !== 'object') {
    return Response.json({ error: { code: 'invalid', message: 'settings 不合法' } }, { status: 400 })
  }

  const settings: ModelSettings = {}
  for (const key of SLOT_KEYS) {
    if (!(key in raw) || raw[key] == null) continue // 缺省/清空该槽
    const slot = parseSlot(raw[key])
    if (!slot) {
      return Response.json(
        { error: { code: 'invalid', message: `${key} 槽需含 providerId 与 model` } },
        { status: 400 },
      )
    }
    settings[key as SlotKey] = slot
  }

  await setModelSettings(ctx, settings)
  return Response.json({ settings })
}
