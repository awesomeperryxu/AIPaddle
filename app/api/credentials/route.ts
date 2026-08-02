import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listCredentials, createCredential, type CredentialKind } from '@/lib/data/credentials'
import { PluginValidationError } from '@/lib/data/plugins'
import { writeAudit } from '@/lib/data/audit'

// V12-2.7：Credential 管理 API。
//
// 🔴 本文件的每个响应都只回 CredentialMasked（无 secret 字段），
// 审计 detail 只记可识别信息。明文永不出现在这一层——
// 它只在 lib/data/credentials.getCredentialPlaintext 被运行时调用方取用。

export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  // 🔴 User / Auditor 一律不给——凭证是最高敏感资产（ADR-007）
  if (!can(ctx, 'credential:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看凭证' } }, { status: 403 })
  }
  const kind = new URL(request.url).searchParams.get('kind') as CredentialKind | null
  return Response.json({ credentials: await listCredentials(ctx, kind ?? undefined) })
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'credential:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建凭证' } }, { status: 403 })
  }
  const b = await request.json().catch(() => ({} as Record<string, unknown>))
  try {
    const credential = await createCredential(ctx, {
      name: String(b?.name ?? ''),
      description: typeof b?.description === 'string' ? b.description : undefined,
      kind: b?.kind,
      secret: String(b?.secret ?? ''),
      meta: b?.meta,
      expiresAt: typeof b?.expiresAt === 'string' ? b.expiresAt : null,
    })
    // 🔴 detail 只记名称/类型，绝不含 secret（哪怕密文也不记）
    await writeAudit(ctx, 'credential.created', 'credential', credential.id, {
      name: credential.name, kind: credential.kind,
    })
    return Response.json({ credential }, { status: 201 })
  } catch (e) {
    if (e instanceof PluginValidationError) {
      return Response.json({ error: { code: 'invalid', message: e.message } }, { status: 400 })
    }
    throw e
  }
}
