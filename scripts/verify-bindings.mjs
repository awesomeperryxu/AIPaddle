#!/usr/bin/env node
/**
 * V12-4.5 / 4.7 / 4.9 的真实调用验收。
 *
 * 🔴 必须在**生产服务器上**运行，三条链路都有环境依赖：
 *   · DB   —— 直连域名只有 IPv6，得走 IPv4 Session Pooler（本机也解析不到）
 *   · 企微 —— 限「企业可信IP」，从别处调必然 60020
 *   · SMTP —— 开发机直连 SMTP 常被代理劫持
 * 而应用就跑在这台机器上，所以经它的 API 触发即可，凭证也不必出服务器。
 *
 * 🔴 全程只做只读探测（probeOnly）：不发企微消息、不发邮件、只跑 select。
 * 建出来的东西在结束时删干净。
 *
 * 用法（在服务器 /opt/aipaddle 下）：
 *   VERIFY_PASSWORD=<管理员密码> node scripts/verify-bindings.mjs
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BASE = process.env.VERIFY_BASE || 'http://localhost:3000'
const jar = new Map()

async function api(path, opts = {}) {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const r = await fetch(BASE + path, {
    ...opts, redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie, ...(opts.headers || {}) },
  })
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';'); const i = kv.indexOf('=')
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim())
  }
  let body = null
  try { body = await r.json() } catch { /* 非 JSON */ }
  return { status: r.status, body }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const TAG = `验收-${Date.now()}`
const created = { plugins: [], credentials: [] }

/** 建 凭证 → Plugin → Tool → 版本，返回 versionId */
async function provision({ label, providerType, bindingType, kind, secret, meta, bindingConfig }) {
  const c = await api('/api/credentials', {
    method: 'POST',
    body: JSON.stringify({ name: `${TAG}-${label}`, kind, secret, meta: meta ?? {} }),
  })
  if (c.status !== 201) throw new Error(`建凭证失败 ${c.status}: ${JSON.stringify(c.body).slice(0, 200)}`)
  created.credentials.push(c.body.credential.id)

  const p = await api('/api/plugins', {
    method: 'POST', body: JSON.stringify({ name: `${TAG}-${label}`, providerType }),
  })
  if (p.status !== 201) throw new Error(`建 Plugin 失败 ${p.status}: ${JSON.stringify(p.body).slice(0, 200)}`)
  created.plugins.push(p.body.plugin.id)

  const t = await api('/api/tools', {
    method: 'POST',
    body: JSON.stringify({
      pluginId: p.body.plugin.id, name: `t_${label}_${Date.now()}`,
      bindingType, riskLevel: 'low',
    }),
  })
  if (t.status !== 201) throw new Error(`建 Tool 失败 ${t.status}: ${JSON.stringify(t.body).slice(0, 200)}`)

  const v = await api(`/api/tools/${t.body.tool.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({ version: '1.0.0', bindingConfig, credentialId: c.body.credential.id }),
  })
  if (v.status !== 201) throw new Error(`建版本失败 ${v.status}: ${JSON.stringify(v.body).slice(0, 200)}`)

  return { toolId: t.body.tool.id, versionId: v.body.version.id }
}

async function runTest(toolId, versionId) {
  const r = await api(`/api/tools/${toolId}/test`, {
    method: 'POST', body: JSON.stringify({ versionId }),
  })
  return r.body?.result ?? { ok: false, message: `HTTP ${r.status}` }
}

function report(name, r) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${name}：${r.message}`)
  if (r.detail) {
    const d = { ...r.detail }
    delete d.sample   // 样例可能较长，单独打
    console.log(`     ${JSON.stringify(d)}`)
    if (r.detail.sample) console.log(`     样例(已脱敏): ${JSON.stringify(r.detail.sample?.[0])}`)
  }
  if (r.truncated !== undefined) console.log(`     截断标记: ${r.truncated}`)
  return r.ok
}

async function cleanup() {
  for (const id of created.plugins) {
    const { data: ts } = await admin.from('tools').select('id').eq('plugin_id', id)
    for (const t of ts ?? []) await admin.from('tool_versions').delete().eq('tool_id', t.id)
    await admin.from('tools').delete().eq('plugin_id', id)
    await admin.from('plugin_versions').delete().eq('plugin_id', id)
    await admin.from('plugins').delete().eq('id', id)
  }
  for (const id of created.credentials) await admin.from('credentials').delete().eq('id', id)
  const { count } = await admin.from('plugins')
    .select('id', { count: 'exact', head: true }).like('name', `${TAG}%`)
  console.log(`\n清理：Plugin ${created.plugins.length} 个、凭证 ${created.credentials.length} 条；残留 ${count ?? 0}`)
}

async function main() {
  const lg = await api('/api/auth/login', {
    method: 'POST',
    // 服务器 .env.local 没有 SEED_PASSWORD（种子只在本地跑过），运行时由外部传入
    body: JSON.stringify({
      email: process.env.VERIFY_EMAIL || 'admin-demo@aipaddle.net',
      password: process.env.VERIFY_PASSWORD || env.SEED_PASSWORD,
    }),
  })
  if (lg.status !== 200) throw new Error(`登录失败 ${lg.status}`)

  let pass = 0, total = 0

  // ── V12-4.5 · DB Binding ──────────────────────────────────────────
  console.log('\n=== V12-4.5 · DB Binding（真实连 Postgres）===')
  total++
  try {
    // 直连域名只有 IPv6，服务器连不上；改用 IPv4 Session Pooler，密码复用 DATABASE_URL 那个
    const u = new URL(env.DATABASE_URL)
    const ref = /db\.([a-z0-9]+)\.supabase\.co/.exec(env.DATABASE_URL)?.[1]
    const region = process.env.SUPABASE_POOLER_REGION || 'aws-0-ap-southeast-2'
    const pooler = `postgresql://postgres.${ref}:${encodeURIComponent(decodeURIComponent(u.password))}`
      + `@${region}.pooler.supabase.com:5432/postgres`

    const { toolId, versionId } = await provision({
      label: 'DB', providerType: 'db', bindingType: 'db', kind: 'db_secret', secret: pooler,
      bindingConfig: {
        query_template: 'select id, name, status from tenants order by created_at',
        allowed_tables: ['tenants'], max_rows: 2, mask_fields: ['name'],
      },
    })
    if (report('查询 tenants（max_rows=2，name 脱敏）', await runTest(toolId, versionId))) pass++
  } catch (e) { console.log(`  ❌ ${e.message}`) }

  // ── V12-4.7 · 企微 native Handler ─────────────────────────────────
  console.log('\n=== V12-4.7 · 企微自建应用（可信 IP 生效处）===')
  total++
  try {
    if (!env.WECOM_CORP_ID || !env.WECOM_CORP_SECRET) throw new Error('服务器缺企微环境变量')
    const { toolId, versionId } = await provision({
      label: 'WECOM', providerType: 'api', bindingType: 'native',
      kind: 'api_key', secret: env.WECOM_CORP_SECRET,
      bindingConfig: {
        handler_id: 'wecom.app_message',
        corp_id: env.WECOM_CORP_ID, agent_id: env.WECOM_AGENT_ID,
        to_user: env.WECOM_TO_USER || '@all',
      },
    })
    // probeOnly：只取 access_token，不发消息
    if (report('取 access_token（不发消息）', await runTest(toolId, versionId))) pass++
  } catch (e) { console.log(`  ❌ ${e.message}`) }

  // ── V12-4.9 · SMTP ────────────────────────────────────────────────
  console.log('\n=== V12-4.9 · SMTP 发信（腾讯企业邮）===')
  total++
  try {
    if (!env.SMTP_USER || !env.SMTP_PASS) throw new Error('服务器缺 SMTP 环境变量')
    const port = Number(env.SMTP_PORT || 465)
    const { toolId, versionId } = await provision({
      label: 'SMTP', providerType: 'smtp', bindingType: 'smtp',
      kind: 'smtp', secret: env.SMTP_PASS,
      // 🔴 非敏感连接参数进 meta，密码进密文列
      meta: { host: env.SMTP_HOST || 'smtp.exmail.qq.com', port, secure: port === 465, user: env.SMTP_USER },
      bindingConfig: {
        from_address: env.SMTP_USER, from_name: env.SMTP_FROM_NAME || '平台通知',
        to: (env.NOTIFY_EMAIL_TO || env.SMTP_USER).split(/[,;\s]+/).filter(Boolean),
        subject_template: '（验收用，不会真发出）', body_template: '<p>x</p>',
      },
    })
    // probeOnly：verify() 做完整连接+握手+认证，但不发信
    if (report('连接+认证（verify，不发信）', await runTest(toolId, versionId))) pass++
  } catch (e) { console.log(`  ❌ ${e.message}`) }

  await cleanup()
  console.log(`\n=== 结果：${pass}/${total} 通过 ===`)
  process.exitCode = pass === total ? 0 : 1
}

main().catch(async (e) => {
  console.error('❌', e.message)
  await cleanup().catch(() => {})
  process.exit(1)
})
