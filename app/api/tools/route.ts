import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listTools, createTool, type BindingType } from '@/lib/data/tools'
import { PluginValidationError } from '@/lib/data/plugins'
import type { PluginStatus } from '@/lib/plugins/status'
import { writeAudit } from '@/lib/data/audit'

// V12-2.7：Tool 管理 API。

export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 Tool' } }, { status: 403 })
  }
  const u = new URL(request.url)
  return Response.json({
    tools: await listTools(ctx, {
      pluginId: u.searchParams.get('pluginId') ?? undefined,
      status: (u.searchParams.get('status') as PluginStatus | null) ?? undefined,
      bindingType: (u.searchParams.get('bindingType') as BindingType | null) ?? undefined,
    }),
  })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Tool' } }, { status: 403 })
  }
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  try {
    const tool = await createTool(ctx, {
      pluginId: String(b?.pluginId ?? ''),
      name: String(b?.name ?? ''),
      displayName: typeof b?.displayName === 'string' ? b.displayName : undefined,
      description: typeof b?.description === 'string' ? b.description : undefined,
      bindingType: b?.bindingType,
      riskLevel: b?.riskLevel,
    })
    await writeAudit(ctx, 'tool.created', 'tool', tool.id, {
      name: tool.name, bindingType: tool.bindingType, riskLevel: tool.riskLevel, pluginId: tool.pluginId,
    })
    return Response.json({ tool }, { status: 201 })
  } catch (e) {
    if (e instanceof PluginValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}
