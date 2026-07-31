/**
 * L2 元测试 · 4.8.10 门控 CI 校验（治理铁律：漏配即无门控 = 高危）
 * 扫描所有 app/api 下的 route.ts，凡含写方法(POST/PUT/PATCH/DELETE)的路由，
 * 必须有鉴权入口：getRequestContext（登录会话）或 CRON_SECRET（定时任务）。
 * 缺失 = 无门控写操作，测试失败并列出违规文件。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const API_DIR = join(process.cwd(), 'app', 'api')
const WRITE_RE = /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/
// 三种合法鉴权入口：
//   getRequestContext        —— 内部路由（Supabase 会话）
//   CRON_SECRET              —— 定时作业入口
//   verifyApiKey             —— 直接校验对外 Key
//   withExtensionIdentity    —— 对外 Extension 端点（V12-8.7）：内部已做 verifyApiKey
//                               + 机器用户身份绑定，是 Key 鉴权的封装形式
// 🔴 新增鉴权方式时应扩这里，**不要往 ALLOWLIST 加豁免**——豁免等于开后门，
//    而且下一个新路由抄了豁免写法就再也没人拦得住。
const AUTH_RE = /getRequestContext\s*\(|CRON_SECRET|verifyApiKey\s*\(|withExtensionIdentity\s*\(/

// 例外（自有鉴权机制，非登录会话）：认证端点本身（登录/注册/回调，此时用户尚未登录）。
const ALLOWLIST: string[] = ['app/api/auth/']

function collectRoutes(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectRoutes(p))
    else if (entry.name === 'route.ts' || entry.name === 'route.tsx') out.push(p)
  }
  return out
}

describe('API 写路由门控校验（4.8.10）', () => {
  it('每个含写方法的路由都有鉴权入口', () => {
    const routes = collectRoutes(API_DIR)
    expect(routes.length).toBeGreaterThan(0)
    const violations: string[] = []
    for (const file of routes) {
      const rel = file.slice(file.indexOf('app/api'))
      if (ALLOWLIST.some((a) => rel.includes(a))) continue
      const src = readFileSync(file, 'utf8')
      if (WRITE_RE.test(src) && !AUTH_RE.test(src)) violations.push(rel)
    }
    expect(violations, `以下写路由缺少鉴权入口（getRequestContext / CRON_SECRET）：\n${violations.join('\n')}`).toEqual([])
  })
})
