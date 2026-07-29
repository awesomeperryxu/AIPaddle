import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { can } from '@/lib/auth/permissions'
import {
  listProvidersForOrg, createProviderForOrg, PROVIDER_TYPES, type ProviderType,
} from '@/lib/data/model-providers'
import { writeAudit } from '@/lib/data/audit'

// 4.8.10：平台超管**代租户**配置模型供应商。
//
// 双重门控，缺一不可：
//   1. isPlatformAdmin(ctx)  —— 平台超管身份（ADR-007 §5：不混进租户角色体系）
//   2. can(ctx, 'provider:manage-any') —— 动作已在 ADR-007 矩阵登记，默认拒绝
// 第 2 条在矩阵里对所有角色留空，因此单靠角色永远为 false；它的作用是让
// 「新增写操作必须登记 action」这条约定落到实处，并在将来若要放开给某角色时有唯一改点。
//
// ⚠️ 与 /api/model-providers（租户自管）的区别：那条按 ctx.orgId 隔离、走 RLS；
// 这条显式指定 orgId、走 admin client，故门控更严。

async function guard(ctx: Awaited<ReturnType<typeof getRequestContext>>) {
  if (!ctx) return { error: Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 }) }
  if (!(await isPlatformAdmin(ctx)) && !can(ctx, 'provider:manage-any')) {
    return { error: Response.json({ error: { code: 'forbidden', message: '仅平台超管可代租户配置模型' } }, { status: 403 }) }
  }
  return { error: null }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  const { error } = await guard(ctx)
  if (error) return error

  const { id: orgId } = await params
  return Response.json({ providers: await listProvidersForOrg(orgId) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  const { error } = await guard(ctx)
  if (error) return error

  const { id: orgId } = await params
  const b = await request.json().catch(() => ({} as Record<string, unknown>))

  if (!PROVIDER_TYPES.includes(b.provider as ProviderType)) {
    return Response.json({ error: { code: 'invalid', message: '供应商类型无效' } }, { status: 400 })
  }
  if (typeof b.apiKey !== 'string' || !b.apiKey.trim()) {
    return Response.json({ error: { code: 'invalid', message: 'API Key 不能为空' } }, { status: 400 })
  }
  if (typeof b.credentialName !== 'string' || !b.credentialName.trim()) {
    return Response.json({ error: { code: 'invalid', message: '凭据名称不能为空' } }, { status: 400 })
  }

  try {
    const provider = await createProviderForOrg(orgId, ctx!.userId, {
      provider: b.provider as ProviderType,
      credentialName: b.credentialName,
      baseUrl: typeof b.baseUrl === 'string' ? b.baseUrl : null,
      apiKey: b.apiKey,
      models: Array.isArray(b.models) ? (b.models as string[]) : undefined,
    })
    // 代配是跨租户写，必须留痕；detail 只记可识别信息，**绝不记 Key**
    await writeAudit(ctx!, 'provider.configured_for_tenant', 'tenant', orgId, {
      providerId: provider.id, provider: provider.provider, credentialName: provider.credentialName,
    })
    return Response.json({ provider }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '配置失败'
    const status = /不能为空|无效|未配置 MODEL_KEY_ENC_SECRET/.test(msg) ? 400 : 500
    return Response.json({ error: { code: status === 400 ? 'invalid' : 'server_error', message: msg } }, { status })
  }
}
