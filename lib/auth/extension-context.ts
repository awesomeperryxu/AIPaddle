import 'server-only'
import type { RequestContext } from '@/lib/context'
import { verifyApiKey, touchApiKeyUsage, type VerifiedKey } from '@/lib/data/api-keys'
import { signServiceUserToken } from './extension-token'
import { runWithExtensionToken } from '@/lib/supabase/extension-scope'
import { createAdminClient } from '@/lib/supabase/admin'

// V12-8.6 / ADR-020：外部请求的身份入口。与内部的 getRequestContext() 严格分家——
// /api/ext/v1/* 禁止 import getRequestContext，内部路由禁止 import 本文件（ADR-020 §2）。
// 两条入口不交叉，才不会出现"内部路由被外部 Key 打开"。

export type ExtensionContext = {
  orgId: string
  extensionId: string
  keyId: string
  scopes: string[]
  allowedOrigins: string[]
  rateLimitPerMin: number | null
  serviceUserId: string
  targetType: string
  targetId: string
  /** 交给 lib/data/* 用的请求上下文；userId = 机器用户 */
  request: RequestContext
}

export type ExtensionAuthError =
  | 'missing_key'      // 没带 Authorization: Bearer
  | 'invalid_key'      // Key 无效 / 已撤销 / 已过期 / Extension 未发布
  | 'no_identity'      // Extension 没配机器用户，签不出令牌
  | 'tenant_suspended' // 租户已停用（ADR-010）

/** 从 Authorization 头取 Bearer token。不接受 query string 传 Key（ADR-020 §4）。 */
function readBearer(req: Request): string | null {
  const raw = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return m ? m[1].trim() : null
}

/** 租户停用检查。此时尚无机器用户令牌，仍属身份识别阶段，故用 admin 客户端只读 tenants 一行。 */
async function isTenantSuspended(orgId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('tenants').select('status').eq('id', orgId).maybeSingle()
  return (data as { status?: string } | null)?.status === 'suspended'
}

/**
 * 解析外部请求身份。成功返回 ExtensionContext，失败返回错误码（不透露细节给调用方）。
 */
export async function getExtensionContext(
  req: Request,
): Promise<{ ok: true; ctx: ExtensionContext } | { ok: false; error: ExtensionAuthError }> {
  const key = readBearer(req)
  if (!key) return { ok: false, error: 'missing_key' }

  const verified: VerifiedKey | null = await verifyApiKey(key)
  if (!verified) return { ok: false, error: 'invalid_key' }

  if (await isTenantSuspended(verified.orgId)) {
    return { ok: false, error: 'tenant_suspended' }
  }
  if (!verified.serviceUserId) {
    // Extension 建好了但没配机器用户 → 签不出可被 RLS 识别的身份，宁可拒绝也不降级用 service_role
    return { ok: false, error: 'no_identity' }
  }

  void touchApiKeyUsage(verified.keyId).catch(() => {}) // 记录使用时间，失败不影响主流程

  return {
    ok: true,
    ctx: {
      orgId: verified.orgId,
      extensionId: verified.extensionId,
      keyId: verified.keyId,
      scopes: verified.scopes,
      allowedOrigins: verified.allowedOrigins,
      rateLimitPerMin: verified.rateLimitPerMin,
      serviceUserId: verified.serviceUserId,
      targetType: verified.targetType,
      targetId: verified.targetId,
      // roles 留空：Extension 不是人，不套用 RBAC 四角色。它能做什么完全由 scopes 决定，
      // 在 /api/ext/v1/* 入口校验（ADR-020 §5），不走 permissions.ts 的角色矩阵。
      request: { userId: verified.serviceUserId, orgId: verified.orgId, roles: [] },
    },
  }
}

/**
 * 在机器用户身份下执行业务逻辑：作用域内 `lib/data/*` 的 createClient() 自动带上
 * 短期令牌，RLS 照常按 org_id 隔离。
 */
export function withExtensionIdentity<T>(ctx: ExtensionContext, fn: () => Promise<T>): Promise<T> {
  return runWithExtensionToken(signServiceUserToken(ctx.serviceUserId), fn)
}

/** Scope 校验：默认拒绝，Key 未显式带该 scope 即无该能力（ADR-020 §5）。 */
export function hasScope(ctx: ExtensionContext, scope: string): boolean {
  return ctx.scopes.includes(scope)
}
