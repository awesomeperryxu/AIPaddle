/**
 * L2 契约测试 · 平台级 API 的门控校验（4.8.10 的「门控 CI」部分）
 *
 * 背景：台账原写「门控 CI 已做」，核实发现 **ci.yml 里没有任何平台门控检查**——
 * 又一处「以为做了其实没做」。而这类漏配的后果最重：跨租户 API 少一道
 * isPlatformAdmin，就等于任何登录用户都能读写别家租户的数据。
 *
 * 本测试用静态扫描守住三条铁律：
 *   1. 凡是调用 lib/data/tenants.ts 平台级函数、或对指定 orgId 操作的路由，
 *      必须出现 isPlatformAdmin；
 *   2. 凡是 import createAdminClient 的路由（绕过 RLS），必须有门控；
 *   3. 新增此类路由若忘了门控，CI 立刻红——而不是等某天被越权访问。
 *
 * 放单测层：毫秒级、不依赖 secrets，每次提交都跑。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const API_DIR = path.join(ROOT, 'app/api')

function collectRoutes(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'route.ts') out.push(p)
    }
  }
  walk(dir)
  return out
}

const ROUTES = collectRoutes(API_DIR)

/** 明确豁免：无跨租户风险，或本就是平台内部用途，附理由 */
const EXEMPT: Record<string, string> = {
  'app/api/cron/agent-schedules/route.ts': '定时作业入口，用 CRON_SECRET 鉴权而非用户会话',
  'app/api/e2e/seed-info/route.ts': '仅测试环境暴露的辅助口，生产关闭',
  'app/api/auth/callback/route.ts': '认证回调，尚无会话',
}

const rel = (p: string) => path.relative(ROOT, p)

/**
 * 去掉注释与字符串字面量后再做匹配。
 * 教训：初版直接对原文 grep，结果**注释里提一句 isPlatformAdmin 就能骗过检查**——
 * 破坏性验证时抽掉真实门控却仍全绿，等于白写。守卫必须看实际代码。
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 块注释
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')  // 行注释（避开 http:// 之类）
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''") // 字符串字面量
}

/**
 * 只剥注释、**保留字符串字面量**。
 * 与 codeOnly() 的区别：codeOnly 会把字符串换成 ''，适合判断「有没有调用某函数」；
 * 但要读取 can(ctx,'xxx') 里的 action 名就必须保留字符串，否则拿到的永远是空串
 * （初版正是这么写的，破坏性验证时故意塞进未登记 action 却依然全绿）。
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
}

describe('平台级 API 门控契约（4.8.10）', () => {
  it('扫描到的路由数量合理（守住扫描逻辑本身失效）', () => {
    expect(ROUTES.length).toBeGreaterThan(20)
  })

  it('🔴 使用 admin client（绕过 RLS）的路由必须有平台门控或权限判定', () => {
    const offenders: string[] = []
    for (const f of ROUTES) {
      const r = rel(f)
      if (EXEMPT[r]) continue
      const src = codeOnly(fs.readFileSync(f, 'utf8'))
      if (!/createAdminClient/.test(src)) continue
      const guarded = /isPlatformAdmin\s*\(|can\s*\(\s*ctx\s*,/.test(src)
      if (!guarded) offenders.push(r)
    }
    expect(
      offenders,
      offenders.length
        ? `以下路由直接使用 admin client（绕过 RLS）却无任何门控：\n` +
          offenders.map((o) => `  · ${o}`).join('\n') +
          `\n必须加 isPlatformAdmin(ctx) 或 can(ctx, <action>)；确无风险请加进 EXEMPT 并写明理由。`
        : '',
    ).toEqual([])
  })

  it('🔴 调用 lib/data/tenants.ts 平台级函数的路由必须过 isPlatformAdmin', () => {
    // 这些函数在数据层注释里已写明「必须由 API 入口的 isPlatformAdmin 兜住」
    const PLATFORM_FNS = [
      'listAllTenants', 'provisionTenant', 'setTenantStatus', 'deleteTenant',
      'getTenantDetail', 'updateTenantByPlatform',
      'listProvidersForOrg', 'createProviderForOrg', 'deleteProviderForOrg',
    ]
    const offenders: string[] = []
    for (const f of ROUTES) {
      const r = rel(f)
      if (EXEMPT[r]) continue
      const src = codeOnly(fs.readFileSync(f, 'utf8'))
      const uses = PLATFORM_FNS.filter((fn) => new RegExp(`\\b${fn}\\b`).test(src))
      if (!uses.length) continue
      // 必须是**实际调用**（isPlatformAdmin(...)），不能只是 import 或注释里提到
      if (!/isPlatformAdmin\s*\(/.test(src)) offenders.push(`${r}（用到 ${uses.join(', ')}）`)
    }
    expect(
      offenders,
      offenders.length
        ? `以下路由调用了平台级数据层函数却未过 isPlatformAdmin：\n` +
          offenders.map((o) => `  · ${o}`).join('\n') +
          `\n这类函数不做 RLS 隔离，漏门控等于任何登录用户可跨租户读写。`
        : '',
    ).toEqual([])
  })

  it('provider:manage-any 已在 ADR-007 矩阵登记（新增写操作必须登记的约定）', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/auth/permissions.ts'), 'utf8')
    expect(src).toContain("'provider:manage-any'")
    // 它是平台超管专属，矩阵里对所有角色留空 → 单靠角色永远拒绝
    expect(src).toMatch(/'provider:manage-any':\s*\[\s*\]/)
  })

  /**
   * 🔴 通用守卫：API 里 can(ctx,'xxx') 用到的 action 必须已在 Action 类型与 MATRIX 登记。
   *
   * 缺口来由：ADR-007 约定「新增写操作先登记 action 再实现 API」，但此前**没有任何自动检查**——
   * 漏登记只会在运行时静默 403（`hasPermission` 查不到即返回 false），CI 全绿、
   * 开发本地也不报错，只有用户点到那个按钮才发现「没权限」。
   * 逐个硬编码检查（如下方 provider:manage-any 那条）挡不住新增的，故加这条全量扫描。
   */
  it('🔴 API 中使用的 action 必须已在 permissions.ts 登记（防漏配静默 403）', () => {
    const perm = fs.readFileSync(path.join(ROOT, 'lib/auth/permissions.ts'), 'utf8')
    const registered = new Set([...perm.matchAll(/^\s*\|\s*'([a-z0-9:_-]+)'/gm)].map((m) => m[1]))

    const offenders: string[] = []
    for (const f of ROUTES) {
      const src = stripComments(fs.readFileSync(f, 'utf8'))
      for (const m of src.matchAll(/\bcan\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*'([a-z0-9:_-]+)'/g)) {
        if (!registered.has(m[1])) offenders.push(`${rel(f)} → '${m[1]}'`)
      }
    }
    expect(
      offenders,
      offenders.length
        ? `以下 action 在 API 中被使用但未登记进 permissions.ts 的 Action 类型：\n` +
          [...new Set(offenders)].map((o) => `  · ${o}`).join('\n') +
          `\n未登记的 action 在 hasPermission 中查不到映射，会**静默返回 403**——CI 不红、` +
          `本地不报错，只有用户点到才发现。请先在 ADR-007 矩阵登记再实现 API。`
        : '',
    ).toEqual([])
  })

  it('V12-8.3：Extension 的 7 个 ext:* action 已登记，且写操作仅限 Admin', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/auth/permissions.ts'), 'utf8')
    for (const a of ['ext:read', 'ext:create', 'ext:update', 'ext:delete',
                     'ext:publish', 'ext:key:manage', 'ext:call-log:read']) {
      expect(src, `${a} 未登记`).toContain(`'${a}'`)
    }
    // 🔴 签发对外 Key = 对外授权，只能 Admin。放开给 Developer 等于让能建 Agent 的人
    // 也能把它开放给公网。
    expect(src).toMatch(/'ext:key:manage':\s*\['Admin'\]/)
    expect(src).toMatch(/'ext:create':\s*\['Admin'\]/)
  })
})
