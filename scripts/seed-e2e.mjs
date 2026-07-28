#!/usr/bin/env node
/**
 * E2E seed（E 道 0.9 测试基建）：幂等地建/更新两租户五账号 + 角色 + 平台超管。
 * 与 tests/e2e/fixtures/test-data.ts 的 TENANTS/USERS 契约保持一致。
 * 走 Supabase 服务级 REST（service_role，HTTPS）——本地可直接运行，无需数据库直连。
 *
 * 用法：SEED_PASSWORD=... node scripts/seed-e2e.mjs   （或先在 .env.local 配好，脚本会自动加载）
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// —— 载入 .env.local（若环境已注入则跳过）——
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch { /* 无 .env.local 时依赖已注入的环境变量 */ }

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_PASSWORD
if (!SB_URL || !KEY) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
if (!PASSWORD) throw new Error('缺少 SEED_PASSWORD')

const admin = createClient(SB_URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const TENANTS = {
  orgA: { name: 'AIPaddle Demo', code: 'aipaddle-demo', plan: 'pro' },
  orgB: { name: 'Acme Corp', code: 'acme-corp', plan: 'standard' },
}
const USERS = [
  { email: 'admin-demo@aipaddle.net', name: 'Demo 管理员', role: 'Admin', org: 'orgA', platformAdmin: true },
  { email: 'dev@aipaddle.net', name: 'Demo 开发者', role: 'Developer', org: 'orgA' },
  { email: 'user@aipaddle.net', name: 'Demo 用户', role: 'User', org: 'orgA' },
  { email: 'auditor@aipaddle.net', name: 'Demo 审计员', role: 'Auditor', org: 'orgA' },
  { email: 'admin-acme@acme.dev', name: 'Acme 管理员', role: 'Admin', org: 'orgB' },
]

// 🔴 不能用 upsert(onConflict:'code')：迁移 0024 起 tenants 的 code 唯一索引是**部分索引**
// （`where deleted_at is null`），PostgREST 的 onConflict 只能给列名、无法表达 WHERE 谓词，
// Postgres 会报 "no unique or exclusion constraint matching the ON CONFLICT specification"。
// 改为显式「先查在册行，有则更新、无则插入」。
async function upsertTenant(t) {
  const { data: found, error: qErr } = await admin
    .from('tenants')
    .select('id')
    .eq('code', t.code)
    .is('deleted_at', null)
    .maybeSingle()
  if (qErr) throw new Error(`tenant ${t.code}: ${qErr.message}`)

  if (found) {
    const { error } = await admin
      .from('tenants')
      .update({ name: t.name, plan_type: t.plan })
      .eq('id', found.id)
    if (error) throw new Error(`tenant ${t.code}: ${error.message}`)
    return found.id
  }

  const { data, error } = await admin
    .from('tenants')
    .insert({ name: t.name, code: t.code, plan_type: t.plan })
    .select('id')
    .single()
  if (error) throw new Error(`tenant ${t.code}: ${error.message}`)
  return data.id
}

async function findAuthUser(email) {
  // 分页查（账号少，一两页即可）
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

// 🔴 幂等策略（2026-07-28 修）：**已存在的账号不再覆盖密码**。
// 事故：seed 每次 CI 都把这批账号的密码强制重设为 SEED_PASSWORD，而 admin-demo
// 同时是人日常登录的管理账号——修 BUG-85 让 push 到 main 也跑 e2e 后，seed 执行
// 频率翻倍，本人密码被反复覆盖，直接登不进去。
// 现在只在**首次创建**时设密码；已存在则仅补齐 metadata 与邮箱确认态。
// 副作用是若有人改了测试账号密码，e2e 会登录失败——那本就该报错让人知道，
// 而不是静默覆盖掉别人的密码。
async function ensureAuthUser(email, orgId, name) {
  const existing = await findAuthUser(email)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true, user_metadata: { org_id: orgId, name },
    })
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { org_id: orgId, name },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

async function main() {
  const orgIds = {}
  for (const [key, t] of Object.entries(TENANTS)) orgIds[key] = await upsertTenant(t)
  console.log('租户就绪:', Object.entries(orgIds).map(([k, v]) => `${k}=${v.slice(0, 8)}`).join(' '))

  for (const u of USERS) {
    const orgId = orgIds[u.org]
    const id = await ensureAuthUser(u.email, orgId, u.name)
    // users 表
    const { error: uErr } = await admin.from('users').upsert(
      { id, org_id: orgId, name: u.name, email: u.email, status: 'active' },
      { onConflict: 'id' },
    )
    if (uErr) throw new Error(`users ${u.email}: ${uErr.message}`)
    // user_roles（幂等：先删该用户该 org 的角色再插，避免重复）
    await admin.from('user_roles').delete().eq('user_id', id).eq('org_id', orgId)
    const { error: rErr } = await admin.from('user_roles').insert({ user_id: id, org_id: orgId, role: u.role })
    if (rErr) throw new Error(`user_roles ${u.email}: ${rErr.message}`)
    // 平台超管
    if (u.platformAdmin) {
      const { error: pErr } = await admin.from('platform_admins').upsert({ user_id: id }, { onConflict: 'user_id' })
      if (pErr) throw new Error(`platform_admins ${u.email}: ${pErr.message}`)
    }
    console.log(`✓ ${u.email} (${u.role}${u.platformAdmin ? ', platform-admin' : ''})`)
  }
  console.log('E2E seed 完成。')
}

main().catch((e) => { console.error('seed 失败:', e.message); process.exit(1) })
