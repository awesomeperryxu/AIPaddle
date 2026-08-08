#!/usr/bin/env node
/**
 * 为已配置 endpoint 的 MCP Server 预设正确的认证方案（auth_config.scheme）。
 *
 * 🔴 依据是 2026-08-08 逐家查证的**官方文档**，不是印象：
 *   Sentry     `Authorization: Sentry-Bearer <token>`
 *              —— 刻意区别于 Bearer，因为 Bearer 被它保留给 MCP OAuth token
 *   Atlassian  个人 API token 用 `Basic base64(email:token)`；服务账号密钥用 Bearer
 *              —— 且需组织管理员先启用 API token 认证
 *   Notion     远程 MCP **不支持** bearer token，只能走 OAuth
 *   其余       标准 `Bearer <token>`
 *
 * 写死 Bearer 的后果是 Sentry / Atlassian 永远 401，而报错只有一句 401，
 * 看不出是 header 格式问题——这正是预设的价值：不让用户逐家去猜。
 *
 * 🔴 只写非敏感的 scheme/username，绝不碰密钥（密钥走 credentials 表加密存储）。
 *
 * 用法：
 *   node scripts/preset-mcp-auth-scheme.mjs           # dry-run
 *   node scripts/preset-mcp-auth-scheme.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/** endpoint 主机名 → 认证方案。按 host 匹配而非按名称，名称是人填的会变。 */
const BY_HOST = [
  { re: /mcp\.sentry\.dev$/i, scheme: 'sentry_bearer', note: 'Sentry-Bearer（官方文档明确区别于 Bearer）' },
  { re: /mcp\.atlassian\.com$/i, scheme: 'basic', note: 'Basic base64(邮箱:token)；需管理员启用 API token' },
  { re: /mcp\.notion\.com$/i, scheme: 'bearer', note: '⚠️ 远程 MCP 不支持 token，只能 OAuth——预设仅占位' },
]
const DEFAULT = { scheme: 'bearer', note: '标准 Bearer' }

function schemeFor(endpoint) {
  try {
    const host = new URL(endpoint).hostname
    return BY_HOST.find((x) => x.re.test(host)) ?? DEFAULT
  } catch { return DEFAULT }
}

async function main() {
  console.log(APPLY ? '=== 预设 MCP 认证方案（执行）===\n' : '=== 预设 MCP 认证方案（DRY-RUN）===\n')

  const { data: servers, error } = await db.from('mcp_servers')
    .select('id,name,endpoint,auth_config').is('deleted_at', null).neq('endpoint', '')
  if (error) { console.error('❌', error.message); process.exit(1) }

  const plan = []
  for (const s of servers ?? []) {
    if (!s.endpoint) continue
    const { scheme, note } = schemeFor(s.endpoint)
    const current = s.auth_config?.scheme
    if (current === scheme) continue          // 已正确，不动
    plan.push({ s, scheme, note, current })
  }

  console.log(`有 endpoint 的 Server：${(servers ?? []).length}，需调整：${plan.length}\n`)
  for (const p of plan) {
    console.log(`  ${p.s.name.padEnd(28)} ${p.current ?? '(未设)'} → ${p.scheme}`)
    console.log(`  ${''.padEnd(28)} ${p.note}`)
  }

  if (!APPLY) { console.log('\nDRY-RUN 结束。加 --apply 执行。'); return }

  let n = 0
  for (const p of plan) {
    // 🔴 保留 auth_config 里已有的 username（用户可能已填），只覆盖 scheme
    const next = { ...(p.s.auth_config ?? {}), scheme: p.scheme }
    const { error: e } = await db.from('mcp_servers')
      .update({ auth_config: next, updated_at: new Date().toISOString() }).eq('id', p.s.id)
    if (e) { console.log(`  ❌ ${p.s.name}: ${e.message}`); continue }
    n++
  }
  console.log(`\n✅ 已更新 ${n} 个 Server 的认证方案`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
