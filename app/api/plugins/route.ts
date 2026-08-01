import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  listPlugins, createPlugin, PluginValidationError,
  type ProviderType, type Plugin,
} from '@/lib/data/plugins'
import type { PluginStatus } from '@/lib/plugins/status'
import { writeAudit } from '@/lib/data/audit'

// V12-2.7：Plugin 管理 API。权限见 ADR-007（读全角色、写 Admin+Developer）。

export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'plugin:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 Plugin' } }, { status: 403 })
  }
  const u = new URL(request.url)
  const providerType = u.searchParams.get('providerType') as ProviderType | null
  const status = u.searchParams.get('status') as PluginStatus | null
  const plugins: Plugin[] = await listPlugins(ctx, {
    providerType: providerType ?? undefined,
    status: status ?? undefined,
  })
  return Response.json({ plugins })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'plugin:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Plugin' } }, { status: 403 })
  }
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  try {
    const plugin = await createPlugin(ctx, {
      name: String(b?.name ?? ''),
      description: typeof b?.description === 'string' ? b.description : undefined,
      providerType: b?.providerType,
      repo: typeof b?.repo === 'string' ? b.repo : null,
      license: typeof b?.license === 'string' ? b.license : null,
      docsUrl: typeof b?.docsUrl === 'string' ? b.docsUrl : null,
      stars: typeof b?.stars === 'number' ? b.stars : null,
    })
    await writeAudit(ctx, 'plugin.created', 'plugin', plugin.id, {
      name: plugin.name, providerType: plugin.providerType,
    })
    return Response.json({ plugin }, { status: 201 })
  } catch (e) {
    if (e instanceof PluginValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}
