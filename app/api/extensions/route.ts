import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listExtensions, createExtension, ExtensionValidationError } from '@/lib/data/extensions'
import { writeAudit } from '@/lib/data/audit'

// V12-8.10：Extension 管理 API（**内部**接口，供扩展能力管理页调用）。
//
// ⚠️ 与 app/api/ext/** 的区别，别混淆：
//   · /api/extensions      —— 内部管理，登录会话 + RBAC，管理员配置 Extension
//   · /api/ext/v1/*        —— 对外调用，API Key 鉴权，外部系统实际使用
// 前者管"谁能开放什么"，后者是"开放出去之后被怎么用"。

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'ext:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看扩展能力' } }, { status: 403 })
  }
  return Response.json({ extensions: await listExtensions(ctx) })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  // 🔴 建 Extension = 把内部资产开放给外部，仅 Admin（ADR-007 / ADR-020）。
  // Developer 能建 Agent 不代表能把它开放给公网。
  if (!can(ctx, 'ext:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建扩展能力' } }, { status: 403 })
  }

  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  try {
    const ext = await createExtension(ctx, {
      name: String(b?.name ?? ''),
      description: typeof b?.description === 'string' ? b.description : undefined,
      targetType: b?.targetType === 'workflow' ? 'workflow' : 'agent',
      targetId: String(b?.targetId ?? ''),
      targetVersion: typeof b?.targetVersion === 'string' ? b.targetVersion : null,
      allowedOrigins: b?.allowedOrigins ?? [],
      rateLimitPerMin: typeof b?.rateLimitPerMin === 'number' ? b.rateLimitPerMin : undefined,
    })
    // 对外开放属高权操作，必须留痕
    await writeAudit(ctx, 'extension.created', 'extension', ext.id, {
      name: ext.name, targetType: ext.targetType, targetId: ext.targetId,
      allowedOrigins: ext.allowedOrigins,
    })
    return Response.json({ extension: ext }, { status: 201 })
  } catch (e) {
    if (e instanceof ExtensionValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}
