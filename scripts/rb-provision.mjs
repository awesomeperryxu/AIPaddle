#!/usr/bin/env node
/**
 * RB-1：开通租户 `royalblack`（黑围裙官网在线咨询）+ 建 6 个知识库骨架。
 *
 * 幂等：已存在则跳过并复用，可重复执行。
 * 用法：node scripts/rb-provision.mjs [--dry-run]
 *
 * ⚠️ 只建租户与知识库**骨架**。内容灌入见 §知识库素材 的说明——
 * 官网 content/site.zh.json 只有页面文案（3.3KB），不足以支撑「服务与报价」
 * 这类问答；缺口已在执行结果里显式列出，不假装灌满了。
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const DRY = process.argv.includes('--dry-run')

// 免依赖加载 .env.local
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

const TENANT = {
  code: 'royalblack',
  name: '黑围裙企业清洁服务',
  contactName: '黑围裙管理员',
  contactEmail: 'admin@royalblack.aipaddle.net',
  tokenQuota: 50_000_000,
}

/**
 * 6 个知识库的划分依据 = 官网咨询场景里访客真正会问的六类问题。
 * 不按官网页面结构切（那是给人看的信息架构，不是问答检索的切面）。
 */
const KBS = [
  { name: '服务目录与范围', desc: '18 种清洁类型的分类、适用场地、包含与不包含的项目' },
  { name: '服务标准与流程', desc: '对标酒店标准的作业规范、SOP、人员资质与培训要求' },
  { name: '服务案例', desc: '按行业与场地类型分类的历史项目案例与效果' },
  { name: '报价与计费规则', desc: '计价方式、影响报价的因素、勘查到出价的流程' },
  { name: '常见问题', desc: '访客高频问题：响应时效、售后、异常处理、合同与结算' },
  { name: '公司与资质', desc: '公司简介、行业认证、服务覆盖范围、联系方式' },
]

const log = (s) => console.log(s)

async function main() {
  log(DRY ? '=== RB-1 开通（演练）===' : '=== RB-1 开通 ===')

  // ── 租户 ──────────────────────────────────────────────
  let { data: tenant } = await admin
    .from('tenants').select('id,code,name').eq('code', TENANT.code).is('deleted_at', null).maybeSingle()

  if (tenant) {
    log(`· 租户已存在，复用：${tenant.name} (${tenant.id.slice(0, 8)})`)
  } else if (DRY) {
    log(`· [dry] 将创建租户 ${TENANT.name} (${TENANT.code})`)
    return
  } else {
    const { data, error } = await admin.from('tenants').insert({
      code: TENANT.code, name: TENANT.name,
      contact_name: TENANT.contactName, contact_email: TENANT.contactEmail,
      token_quota: TENANT.tokenQuota, status: 'active',
    }).select('id,code,name').single()
    if (error) throw new Error(`建租户失败：${error.message}`)
    tenant = data
    log(`✅ 租户已创建：${tenant.name} (${tenant.id.slice(0, 8)})`)
  }

  // ── 知识库 ────────────────────────────────────────────
  const { data: existing } = await admin
    .from('knowledge_bases').select('name').eq('org_id', tenant.id).is('deleted_at', null)
  const have = new Set((existing ?? []).map((k) => k.name))

  let created = 0
  for (const kb of KBS) {
    if (have.has(kb.name)) { log(`· 知识库已存在：${kb.name}`); continue }
    if (DRY) { log(`· [dry] 将创建知识库：${kb.name}`); continue }
    const { error } = await admin.from('knowledge_bases').insert({
      org_id: tenant.id, name: kb.name, description: kb.desc, visibility: 'org',
    })
    if (error) { log(`❌ ${kb.name}：${error.message}`); continue }
    log(`✅ 知识库已创建：${kb.name}`)
    created++
  }

  log('')
  log(`完成：租户 ${tenant.code}，新建知识库 ${created} 个（共 ${KBS.length} 个）`)
  log('')
  log('🔴 内容灌入缺口（RB-1 验收标准要求「可检索出服务目录/案例/报价规则原文」）：')
  log('   官网 content/site.zh.json 仅 3.3KB 页面文案，能支撑的只有：')
  log('     · 服务目录与范围 —— products 字段有 4 大类 11 小项，可用但过简')
  log('     · 服务案例       —— cases 字段仅 3 条，缺行业/场地维度')
  log('     · 公司与资质     —— pillars/standards 可用')
  log('   完全没有素材的：')
  log('     · 报价与计费规则 —— 官网无任何价格信息（这是刻意的商业策略）')
  log('     · 服务标准与流程 —— 只有宣传语，无实际 SOP')
  log('     · 常见问题       —— 官网无 FAQ 板块')
  log('   ⚠️ 需业务方补充素材后才能达成验收标准，不能只靠官网文案。')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
