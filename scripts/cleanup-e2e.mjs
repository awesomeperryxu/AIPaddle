#!/usr/bin/env node
/**
 * 4.9.2：清理 e2e 跑出来的残留数据。
 *
 * 为什么需要：stages 用例会真写库（S0-AUTH-01 每次注册一个新账号、
 * S0-DAL-02 每次建一个 Agent）。不清理的话每跑一次 CI 就往生产库堆一份垃圾，
 * 「让 stages 在 CI 跑」这件事就永远无法被接受。有了它，写入才是**临时的**。
 *
 * 识别方式一律按 e2e 专属命名，绝不按时间或数量猜：
 *   · 注册账号：e2e.reg.<时间戳>@aipaddle-test.local
 *   · 持久化验证 Agent：名称以「持久化验证-」开头
 *   · 邀请测试成员：tests/e2e/fixtures 的 MEMBER_INVITES（固定邮箱）
 *   · 开通测试租户：TENANT_ONBOARDING 的固定 code
 *
 * 🔴 保护名单：seed 的固定账号（adminA/devA/userA/auditorA/adminB）与
 * 人日常账号（perry@）绝不删——它们不是 e2e 产物。见 BUG-90 的教训。
 *
 * 用法：node scripts/cleanup-e2e.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const DRY = process.argv.includes('--dry-run')

// 免依赖加载 .env.local（与 playwright.config 同款做法）
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(url, key, { auth: { persistSession: false } })

// 🔴 绝不删除的账号（seed 固定账号 + 人日常账号）
const PROTECTED = new Set([
  'admin-demo@aipaddle.net', 'dev@aipaddle.net', 'user@aipaddle.net',
  'auditor@aipaddle.net', 'admin-acme@acme.dev', 'perry@aipaddle.net',
])

let removed = { authUsers: 0, users: 0, agents: 0, tenants: 0 }

// 一律**软删**而非物理删除：业务表被外键引用（如 call_logs.agent_id、
// agents.created_by），物理删会被阻断；且项目本就是全表软删（C6）。
// 统计口径全部带 `deleted_at is null`，软删即等于清干净。
const NOW = () => new Date().toISOString()

async function softDelete(table, match, label) {
  const { error } = await admin.from(table).update({ deleted_at: NOW() }).match(match).is('deleted_at', null)
  if (error) { console.log(`  ❌ ${label}: ${error.message}`); return false }
  return true
}

async function cleanupRegisteredAccounts() {
  // e2e.reg.<ts>@aipaddle-test.local —— S0-AUTH-01 每跑一次产生一个
  const { data: rows } = await admin.from('users').select('id,email').like('email', 'e2e.reg.%').is('deleted_at', null)
  for (const r of rows ?? []) {
    if (PROTECTED.has(r.email)) continue
    if (DRY) { console.log(`  [dry] 账号 ${r.email}`); removed.users++; continue }
    await softDelete('user_roles', { user_id: r.id }, `roles ${r.email}`)
    if (!await softDelete('users', { id: r.id }, `账号 ${r.email}`)) continue
    // auth 账号封禁而非删除：删除会级联影响 users 行，且外键引用会阻断
    const { error } = await admin.auth.admin.updateUserById(r.id, { ban_duration: '876600h' })
    if (!error) removed.authUsers++
    removed.users++
  }
}

async function cleanupAgents() {
  // 「持久化验证-<ts>」—— S0-DAL-02 每跑一次产生一个
  const { data: rows } = await admin.from('agents').select('id,name').like('name', '持久化验证-%').is('deleted_at', null)
  for (const r of rows ?? []) {
    if (DRY) { console.log(`  [dry] Agent ${r.name}`); removed.agents++; continue }
    await softDelete('agent_resources', { agent_id: r.id }, `资源 ${r.name}`)
    if (await softDelete('agents', { id: r.id }, `Agent ${r.name}`)) removed.agents++
  }
}

async function cleanupInvitedMembers() {
  // S5-01 邀请的固定测试邮箱（含 4.8.18 新增的弱口令用例邮箱）
  const { data: rows } = await admin.from('users').select('id,email').is('deleted_at', null)
    .or('email.like.new.%@aipaddle-test.local,email.like.weak.%@aipaddle-test.local')
  for (const r of rows ?? []) {
    if (PROTECTED.has(r.email)) continue
    if (DRY) { console.log(`  [dry] 成员 ${r.email}`); removed.users++; continue }
    await softDelete('user_roles', { user_id: r.id }, `roles ${r.email}`)
    if (!await softDelete('users', { id: r.id }, `成员 ${r.email}`)) continue
    await admin.auth.admin.updateUserById(r.id, { ban_duration: '876600h' })
    removed.users++
  }
}

async function cleanupTestTenants() {
  // S5-04 开通的测试企业（fixtures 里的固定 code）
  const { data: rows } = await admin.from('tenants').select('id,code,name').like('code', 'e2e-%').is('deleted_at', null)
  for (const r of rows ?? []) {
    if (DRY) { console.log(`  [dry] 租户 ${r.name}(${r.code})`); removed.tenants++; continue }
    const { data: members } = await admin.from('users').select('id,email').eq('org_id', r.id).is('deleted_at', null)
    for (const m of members ?? []) {
      if (PROTECTED.has(m.email)) continue
      await softDelete('user_roles', { user_id: m.id }, `roles ${m.email}`)
      await softDelete('users', { id: m.id }, `成员 ${m.email}`)
      await admin.auth.admin.updateUserById(m.id, { ban_duration: '876600h' })
    }
    if (await softDelete('tenants', { id: r.id }, `租户 ${r.code}`)) removed.tenants++
  }
}

console.log(DRY ? '=== e2e 残留清理（演练，不实际删除）===' : '=== e2e 残留清理 ===')
await cleanupRegisteredAccounts()
await cleanupAgents()
await cleanupInvitedMembers()
await cleanupTestTenants()
console.log(`完成：账号 ${removed.users} / auth ${removed.authUsers} / Agent ${removed.agents} / 租户 ${removed.tenants}`)
