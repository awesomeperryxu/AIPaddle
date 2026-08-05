import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Key-2：平台超管跨租户 Key 总览。比照 platform-dashboard.ts —— admin client 跨租户只读聚合。
// ⚠️ 必须由 API/页面入口的 isPlatformAdmin 兜住；此层不做 RLS 隔离。
//
// 🔴 明文永远拿不到，平台超管也一样：库里只有 sha256(key_hash) 与前 15 位前缀。
//    本页能做的是清点 / 审计 / 吊销，**不是**帮客户找回密钥——找回只能重新签发。

export type PlatformApiKey = {
  id: string
  name: string
  keyPrefix: string          // 前缀 + 掩码，与租户端同一脱敏口径
  scope: string
  status: 'active' | 'revoked'
  lastUsedAt: string | null
  createdAt: string          // 已格式化为 Asia/Shanghai 的 YYYY-MM-DD HH:mm
  expiresAt: string | null
  orgId: string
  orgName: string
  orgStatus: string          // 租户 suspended 时，其 Key 即便 active 也调不通
  extensionId: string | null
  extensionName: string | null   // null = 租户通用 Key
  createdByName: string | null   // 签发人显示名；查不到 = 用户已删
  createdByEmail: string | null
}

type KeyRow = {
  id: string; org_id: string; name: string; key_prefix: string; scope: string | null
  last_used_at: string | null; revoked_at: string | null; created_at: string | null
  expires_at: string | null; extension_id: string | null; created_by: string | null
}

/**
 * 时间戳 → `YYYY-MM-DD HH:mm`（Asia/Shanghai）。
 *
 * 🔴 库里存的是 UTC。直接 slice(0,10) 只丢掉时分还算无害，但一旦要显示时分，
 * 不转时区就会差 8 小时——今晚 20:11 签发的 Key 会显示成 12:11，运营对不上账。
 * 固定用 Asia/Shanghai 而非浏览器时区：值在服务端算好，避免 SSR/CSR hydration 不一致。
 */
export function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`
}

/**
 * 全平台 Key 清单（跨租户）。仅平台超管可调用。
 *
 * 排序：先按租户名，再按创建时间倒序——运营场景是「看某家客户有几把钥匙」，
 * 按时间全局排会把同一租户的 Key 打散到列表各处。
 */
export async function listAllApiKeys(): Promise<PlatformApiKey[]> {
  const admin = createAdminClient()

  const [keysRes, tenantsRes, extsRes, usersRes] = await Promise.all([
    admin.from('api_keys')
      .select('id,org_id,name,key_prefix,scope,last_used_at,revoked_at,created_at,expires_at,extension_id,created_by')
      .order('created_at', { ascending: false }),
    admin.from('tenants').select('id,name,status').is('deleted_at', null),
    // 含软删扩展：Key 可能还绑在已删扩展上，那正是运营需要发现并清理的情况
    admin.from('extensions').select('id,name,deleted_at'),
    // 含软删用户：签发人可能已离职被删，仍要能追溯到是谁签的
    admin.from('users').select('id,name,email'),
  ])
  if (keysRes.error) throw new Error(keysRes.error.message)
  if (tenantsRes.error) throw new Error(tenantsRes.error.message)
  if (extsRes.error) throw new Error(extsRes.error.message)
  if (usersRes.error) throw new Error(usersRes.error.message)

  const tenantById = new Map(
    ((tenantsRes.data as { id: string; name: string; status: string }[] | null) ?? [])
      .map((t) => [t.id, t]),
  )
  const extById = new Map(
    ((extsRes.data as { id: string; name: string; deleted_at: string | null }[] | null) ?? [])
      .map((e) => [e.id, e]),
  )
  const userById = new Map(
    ((usersRes.data as { id: string; name: string | null; email: string | null }[] | null) ?? [])
      .map((u) => [u.id, u]),
  )

  const rows = ((keysRes.data as KeyRow[] | null) ?? []).map((r): PlatformApiKey => {
    const t = tenantById.get(r.org_id)
    const ext = r.extension_id ? extById.get(r.extension_id) : undefined
    const u = r.created_by ? userById.get(r.created_by) : undefined
    return {
      id: r.id,
      name: r.name,
      keyPrefix: `${r.key_prefix}${'*'.repeat(8)}`,
      scope: r.scope ?? 'agent',
      status: r.revoked_at ? 'revoked' : 'active',
      lastUsedAt: r.last_used_at ? fmtTime(r.last_used_at) : null,
      createdAt: fmtTime(r.created_at),
      expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : null,
      // created_by 为空 = 迁移前的历史 Key；查不到用户 = 已被删除。两者都要标出来，
      // 显示空白会让人以为「系统自动生成」，追责时找不到人
      createdByName: r.created_by ? (u?.name ?? u?.email ?? '(用户已删除)') : null,
      createdByEmail: u?.email ?? null,
      orgId: r.org_id,
      // 租户已被硬删/软删时不静默显示空白，标出来让运营能发现孤儿 Key
      orgName: t?.name ?? '(租户已删除)',
      orgStatus: t?.status ?? 'unknown',
      extensionId: r.extension_id,
      extensionName: r.extension_id
        ? (ext ? (ext.deleted_at ? `${ext.name}（已删除）` : ext.name) : '(扩展已删除)')
        : null,
    }
  })

  return rows.sort((a, b) =>
    a.orgName.localeCompare(b.orgName, 'zh-CN') || b.createdAt.localeCompare(a.createdAt),
  )
}

/**
 * 跨租户吊销 Key。仅平台超管可调用。
 *
 * 用 admin client 是因为目标 Key 通常不属于操作者的租户，请求级客户端会被 RLS 挡下。
 * 只写 revoked_at 一列，不碰任何其它字段——这是本文件唯一的写操作。
 */
export async function revokeAnyApiKey(id: string): Promise<PlatformApiKey | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)      // 已吊销的不重复写，避免刷新吊销时间掩盖真实时点
    .select('id,org_id,name,key_prefix,extension_id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const all = await listAllApiKeys()
  return all.find((k) => k.id === id) ?? null
}
