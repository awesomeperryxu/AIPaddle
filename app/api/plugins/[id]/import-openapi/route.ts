import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getPluginById } from '@/lib/data/plugins'
import { createTool } from '@/lib/data/tools'
import { createToolVersion } from '@/lib/data/tool-versions'
import { PluginValidationError } from '@/lib/data/plugins'
import { deriveToolsFromOpenApi, BindingConfigError } from '@/lib/plugins/binding'
import { writeAudit } from '@/lib/data/audit'

// V12-4.3 · AC-02：导入 OpenAPI 文档，按 operation 拆成多个 Tool。
//
// 🔴 只接受请求体里直接带的文档 JSON，**不接受 URL 让服务端去拉**。
// 服务端拉取任意 URL 就是 SSRF——内网地址、云元数据端点都在射程内。
// 文档由浏览器取好再传上来，网络请求的发起方留在客户端。

const MAX_TOOLS = 200

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'tool:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建 Tool' } }, { status: 403 })
  }
  const { id } = await params
  const plugin = await getPluginById(ctx, id)
  if (!plugin) {
    return Response.json({ error: { code: 'not_found', message: 'Plugin 不存在' } }, { status: 404 })
  }
  if (plugin.providerType !== 'api') {
    return Response.json(
      { error: { code: 'invalid', message: '只有 API 类型的 Plugin 支持 OpenAPI 导入' } },
      { status: 400 },
    )
  }

  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  const allowedHosts = Array.isArray(b?.allowedHosts) ? b.allowedHosts as string[] : []

  let derived
  try {
    derived = deriveToolsFromOpenApi(
      b?.document, allowedHosts,
      typeof b?.baseUrl === 'string' ? b.baseUrl : undefined,
    )
  } catch (e) {
    if (e instanceof BindingConfigError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
  if (derived.length > MAX_TOOLS) {
    return Response.json(
      { error: { code: 'invalid', message: `文档含 ${derived.length} 个 operation，超过单次导入上限 ${MAX_TOOLS}` } },
      { status: 400 },
    )
  }

  // 🔴 逐个建，失败的记下来继续——不做「全成功或全回滚」。
  // 没有跨表事务可用，硬凑回滚会在中途失败时留下更难收拾的残局；
  // 而这里每个 Tool 都是独立草稿，部分成功是可接受且可见的状态。
  // 关键是**如实报告**：哪些建了、哪些没建、为什么。
  const created: { name: string; toolId: string }[] = []
  const failed: { name: string; reason: string }[] = []

  for (const d of derived) {
    try {
      const tool = await createTool(ctx, {
        pluginId: id,
        name: d.name,
        displayName: d.displayName,
        description: d.description,
        bindingType: 'api',
        riskLevel: 'medium',
      })
      await createToolVersion(ctx, {
        toolId: tool.id,
        version: '1.0.0',
        bindingConfig: d.bindingConfig,
        changelog: `由 OpenAPI 文档导入（operation: ${d.bindingConfig.operation_id ?? d.name}）`,
      })
      created.push({ name: d.name, toolId: tool.id })
    } catch (e) {
      const msg = e instanceof PluginValidationError || e instanceof BindingConfigError
        ? e.message : '创建失败'
      failed.push({ name: d.name, reason: msg })
    }
  }

  await writeAudit(ctx, 'plugin.openapi.imported', 'plugin', id, {
    total: derived.length, created: created.length, failed: failed.length,
  })

  return Response.json({
    imported: created.length,
    total: derived.length,
    created,
    failed,   // 前端必须把这个显示出来，否则「导入了 12 个」会盖掉「3 个没建成」
  }, { status: 201 })
}
