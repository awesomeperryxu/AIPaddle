import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listToolVersions, createToolVersion } from '@/lib/data/tool-versions'
import { PluginValidationError } from '@/lib/data/plugins'
import { BindingConfigError } from '@/lib/plugins/binding'
import { writeAudit } from '@/lib/data/audit'

// V12-4.3 / V12-4.4：Tool 版本 API（Binding 配置的落点）。

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 Tool' } }, { status: 403 })
  }
  const { id } = await params
  return Response.json({ versions: await listToolVersions(ctx, id) })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：编辑 Tool' } }, { status: 403 })
  }
  const { id } = await params
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  try {
    const v = await createToolVersion(ctx, {
      toolId: id,
      version: String(b?.version ?? ''),
      bindingConfig: b?.bindingConfig,
      inputSchema: b?.inputSchema,
      outputSchema: b?.outputSchema,
      credentialId: typeof b?.credentialId === 'string' ? b.credentialId : null,
      changelog: typeof b?.changelog === 'string' ? b.changelog : undefined,
    })
    // 🔴 审计只记版本号与是否绑了凭证，不记 bindingConfig 本身——
    // 里面有 endpoint、查询模板这类内部拓扑信息，没必要摊进审计日志
    await writeAudit(ctx, 'tool.version.created', 'tool', id, {
      versionId: v.id, version: v.version, hasCredential: !!v.credentialId,
    })
    return Response.json({ version: v }, { status: 201 })
  } catch (e) {
    if (e instanceof PluginValidationError || e instanceof BindingConfigError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}
