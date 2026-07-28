/**
 * Seed 脚本：创建测试租户和账号
 * 运行：pnpm dlx tsx supabase/seed.ts
 *
 * 创建内容：
 *   租户：AIPaddle Demo（code: aipaddle-demo）、Acme Corp（code: acme-corp）
 *   账号：admin-demo@aipaddle.net（Admin）、admin-acme@acme.dev（Admin）
 *         dev@aipaddle.net（Developer）、user@aipaddle.net（User）
 *         auditor@aipaddle.net（Auditor）
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
// 密码从环境变量读取，绝不硬编码进 git（仓库公开后的安全铁律）
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DEFAULT_PASSWORD) {
  console.error('缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SEED_PASSWORD')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 🔴 迁移 0024 起 tenants.code 唯一索引是部分索引（where deleted_at is null），
// onConflict 无法表达 WHERE 谓词，必须显式先查后写。
async function ensureTenant(name: string, code: string, planType: string = 'standard') {
  const { data: found } = await admin
    .from('tenants').select('id').eq('code', code).is('deleted_at', null).maybeSingle()

  const { data, error } = found
    ? await admin.from('tenants')
        .update({ name, plan_type: planType, status: 'active' })
        .eq('id', (found as { id: string }).id)
        .select('id, name, code').single()
    : await admin.from('tenants')
        .insert({ name, code, plan_type: planType, status: 'active' })
        .select('id, name, code').single()

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

  // 🔴 迁移 0025 起 user_roles 唯一索引是部分索引（where deleted_at is null），同样不能用 onConflict
  const { data: roleFound } = await admin
    .from('user_roles').select('id')
    .eq('user_id', userId).eq('role', role).is('deleted_at', null).maybeSingle()
  const { error: roleErr } = roleFound
    ? { error: null }
    : await admin.from('user_roles').insert({ user_id: userId, org_id: orgId, role })
  if (roleErr) throw new Error(`写入 user_roles 失败: ${roleErr.message}`)

  console.log(`    → org=${orgId} role=${role}`)
  return userId
}

// 幂等建 Agent：按 (org_id, name) 判重，供隔离用例提供可测的租户资源。
async function ensureAgent(orgId: string, createdBy: string, name: string, department: string) {
  const { data: existing } = await admin
    .from('agents')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    console.log(`  ✓ Agent 已存在: ${name} id=${existing.id}`)
    return existing.id as string
  }
  const { data, error } = await admin
    .from('agents')
    .insert({ org_id: orgId, created_by: createdBy, name, department, status: 'published' })
    .select('id')
    .single()
  if (error) throw new Error(`建 Agent 失败(${name}): ${error.message}`)
  console.log(`  ✓ Agent: ${name} id=${data.id}`)
  return data.id as string
}

async function main() {
  console.log('=== AIPaddle Seed 开始 ===\n')

  console.log('【租户】')
  const tenantDemo = await ensureTenant('AIPaddle Demo', 'aipaddle-demo', 'pro')
  const tenantAcme = await ensureTenant('Acme Corp', 'acme-corp', 'standard')

  console.log('\n【账号】')
  const adminDemoId = await ensureAccount('admin-demo@aipaddle.net', 'Admin', tenantDemo.id, 'Demo 管理员')
  await ensureAccount('dev@aipaddle.net', 'Developer', tenantDemo.id, 'Demo 开发者')
  await ensureAccount('user@aipaddle.net', 'User', tenantDemo.id, 'Demo 用户')
  await ensureAccount('auditor@aipaddle.net', 'Auditor', tenantDemo.id, 'Demo 审计员')
  const adminAcmeId = await ensureAccount('admin-acme@acme.dev', 'Admin', tenantAcme.id, 'Acme 管理员')

  console.log('\n【Agent（每租户 1 个，供隔离/API 用例）】')
  await ensureAgent(tenantDemo.id, adminDemoId, '客服问答助手', '市场部')
  await ensureAgent(tenantAcme.id, adminAcmeId, 'Acme 内部助手', '综合部')

  console.log(`\n=== Seed 完成 ===`)
  console.log(`默认密码: 见环境变量 SEED_PASSWORD（不打印）`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
