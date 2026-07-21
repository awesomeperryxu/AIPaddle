/**
 * 轮换 seed 账号密码脚本
 * 运行：SEED_PASSWORD='<新密码>' pnpm dlx tsx supabase/rotate-passwords.ts
 *   （或把新密码写入 .env.local 的 SEED_PASSWORD 后，用 dotenv/--env-file 加载再运行）
 *
 * 背景：老密码 AIPaddle@2026 已随仓库公开进入 git 历史（永久泄露），
 *   必须轮换线上账号密码。seed.ts 对已存在账号不改密码，故用本脚本以
 *   admin.updateUserById 强制重置全部 seed 账号密码。
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const NEW_PASSWORD = process.env.SEED_PASSWORD!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !NEW_PASSWORD) {
  console.error('缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SEED_PASSWORD')
  process.exit(1)
}
if (NEW_PASSWORD === 'AIPaddle@2026') {
  console.error('❌ SEED_PASSWORD 仍是已泄露的旧密码，请改成新密码再运行')
  process.exit(1)
}

const EMAILS = [
  'admin-demo@aipaddle.dev',
  'dev@aipaddle.dev',
  'user@aipaddle.dev',
  'auditor@aipaddle.dev',
  'admin-acme@acme.dev',
]

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  let ok = 0
  for (const email of EMAILS) {
    const u = users.find(x => x.email === email)
    if (!u) { console.log(`  ~ 跳过（不存在）: ${email}`); continue }
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { password: NEW_PASSWORD })
    if (upErr) { console.error(`  ✗ ${email}: ${upErr.message}`); continue }
    console.log(`  ✓ 已轮换: ${email}`)
    ok++
  }
  console.log(`\n=== 完成：${ok}/${EMAILS.length} 个账号密码已轮换 ===`)
}

main().catch((e) => { console.error(e); process.exit(1) })
