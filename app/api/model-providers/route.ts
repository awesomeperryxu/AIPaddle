import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  listProviders,
  createProvider,
  PROVIDER_TYPES,
  type ProviderType,
} from '@/lib/data/model-providers'

// ADR-016 4.7.3：租户模型供应商 CRUD。权限 provider:manage（Admin，见 ADR-007 矩阵）。
// Key 一律加密写 / 脱敏读，明文绝不出网关（数据层 toMasked 保证）。

function isProviderType(v: unknown): v is ProviderType {
  return typeof v === 'string' && (PROVIDER_TYPES as readonly string[]).includes(v)
}

function toStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined
}

// GET /api/model-providers —— 本租户供应商清单（脱敏）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const providers = await listProviders(ctx)
  return Response.json({ providers })
}

// POST /api/model-providers —— 新增供应商（加密 Key 落库，返回脱敏视图）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  if (!isProviderType(body?.provider)) {
    return Response.json({ error: { code: 'invalid', message: 'provider 不合法' } }, { status: 400 })
  }
  const credentialName = String(body?.credentialName ?? '').trim()
  if (!credentialName) {
    return Response.json({ error: { code: 'invalid', message: '凭证名称不能为空' } }, { status: 400 })
  }
  const apiKey = String(body?.apiKey ?? '')
  if (!apiKey) {
    return Response.json({ error: { code: 'invalid', message: 'API Key 不能为空' } }, { status: 400 })
  }
  const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl.trim() ? body.baseUrl.trim() : null

  try {
    const provider = await createProvider(ctx, {
      provider: body.provider,
      credentialName,
      baseUrl,
      apiKey,
      models: toStringArray(body?.models),
    })
    return Response.json({ provider }, { status: 201 })
  } catch (e) {
    // 主密钥缺失（isEncryptionAvailable=false）等业务前置失败 → 409，携带原因。
    const message = e instanceof Error ? e.message : '创建供应商失败'
    return Response.json({ error: { code: 'conflict', message } }, { status: 409 })
  }
}
