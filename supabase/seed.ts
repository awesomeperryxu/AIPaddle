/**
 * Seed 脚本：创建测试租户和账号
 * 运行：pnpm dlx tsx supabase/seed.ts
 *
 * 创建内容：
 *   租户：AIPaddle Demo（code: aipaddle-demo）、Acme Corp（code: acme-corp）
 *   账号：admin-demo@aipaddle.dev（Admin）、admin-acme@acme.dev（Admin）
 *         dev@aipaddle.dev（Developer）、user@aipaddle.dev（User）
 *         auditor@aipaddle.dev（Auditor）
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DEFAULT_PASSWORD = 'AIPaddle@2026'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureTenant(name: string, code: string, planType: string = 'standard') {
  const { data, error } = await admin
    .from('tenants')
    .upsert(
      { name, code, plan_type: planType, status: 'active' },
      { onConflict: 'code' },
    )
    .select('id, name, code')
    .single()

  if (error) throw new Error(`创建租户 ${name} 失败: ${error.message}`)
  console.log(`  ✓ 租户: ${data.name} (${data.code}) id=${data.id}`)
  return data
}

async function ensureAccount(
  email: string,
  role: string,
  orgId: string,
  name: string,
) {
  let userId: string

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  })

  if (createErr) {
    if (createErr.message.includes('already been registered')) {
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
      if (listErr) throw listErr
      const existing = users.find(u => u.email === email)
      if (!existing) throw new Error(`找不到已存在用户 ${email}`)
      userId = existing.id
      console.log(`  ~ 用户已存在: ${email}`)
    } else {
      throw new Error(`创建用户 ${email} 失败: ${createErr.message}`)
    }
  } else {
    userId = created.user!.id
    console.log(`  ✓ 用户: ${email}`)
  }

  const { error: userErr } = await admin
    .from('users')
    .upsert(
      { id: userId, org_id: orgId, email, name, status: 'active' },
      { onConflict: 'id' },
    )
  if (userErr) throw new Error(`写入 users 失败: ${userErr.message}`)

  const { error: roleErr } = await admin
    .from('user_roles')
    .upsert(
      { user_id: userId, org_id: orgId, role },
      { onConflict: 'user_id,role' },
    )
  if (roleErr) throw new Error(`写入 user_roles 失败: ${roleErr.message}`)

  console.log(`    → org=${orgId} role=${role}`)
  return userId
}

async function main() {
  console.log('=== AIPaddle Seed 开始 ===\n')

  console.log('【租户】')
  const tenantDemo = await ensureTenant('AIPaddle Demo', 'aipaddle-demo', 'pro')
  const tenantAcme = await ensureTenant('Acme Corp', 'acme-corp', 'standard')

  console.log('\n【账号】')
  await ensureAccount('admin-demo@aipaddle.dev', 'Admin', tenantDemo.id, 'Demo 管理员')
  await ensureAccount('dev@aipaddle.dev', 'Developer', tenantDemo.id, 'Demo 开发者')
  await ensureAccount('user@aipaddle.dev', 'User', tenantDemo.id, 'Demo 用户')
  await ensureAccount('auditor@aipaddle.dev', 'Auditor', tenantDemo.id, 'Demo 审计员')
  await ensureAccount('admin-acme@acme.dev', 'Admin', tenantAcme.id, 'Acme 管理员')

  console.log(`\n=== Seed 完成 ===`)
  console.log(`默认密码: ${DEFAULT_PASSWORD}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
