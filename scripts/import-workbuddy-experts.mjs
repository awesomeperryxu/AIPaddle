#!/usr/bin/env node
/**
 * 从 WorkBuddy 的专家模块导入预设到 AIPaddle 的数字员工。
 *
 * 筛选范围：数据分析(04)、内容创作(06)、法务安全(11) 三个分类 +
 * 其他分类中包含「文档/报告/编辑/写作/翻译」关键词的专家。
 *
 * 用法：
 *   node scripts/import-workbuddy-experts.mjs           # dry-run
 *   node scripts/import-workbuddy-experts.mjs --apply    # 执行
 */
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const MANIFEST = path.join(process.env.HOME, '.workbuddy/app/cache/experts/manifest.json')

// AIPaddle API
const envPath = path.resolve(process.cwd(), '.env.local')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const BASE = 'https://aipaddle.net'
const jar = new Map()
async function api(p, opts = {}) {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const r = await fetch(BASE + p, {
    ...opts, redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie, ...(opts.headers || {}) },
  })
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';'); const i = kv.indexOf('=')
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim())
  }
  let body = null
  try { body = await r.json() } catch {}
  return { status: r.status, body }
}

// 分类映射：WorkBuddy 分类 → AIPaddle department
const CAT_MAP = {
  '04-DataAI': '数据智能',
  '06-ContentCreative': '内容创作',
  '11-SecurityCompliance': '法务安全',
  '01-ProductDesign': '产品设计',
  '02-Engineering': '技术工程',
  '03-GameSpatial': '游戏空间',
  '05-MarketingGrowth': '营销增长',
  '07-SalesCommerce': '销售商务',
  '08-FinanceInvestment': '金融投资',
  '09-OperationsHR': '运营人力',
  '10-ProjectQuality': '项目质量',
  '12-IndustryConsultant': '行业顾问',
  '13-TencentZone': '腾讯专区',
  '14-GlobalDevelopment': '全球发展',
}

const WANT_CATS = new Set(['04-DataAI', '06-ContentCreative', '11-SecurityCompliance'])
const DOC_KEYWORDS = ['文档', '报告', 'document', 'report', '编辑', '写作', '翻译']

function getText(v, lang = 'zh') {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v[lang] || v.en || v.zh || ''
}

async function main() {
  console.log(APPLY ? '=== 导入 WorkBuddy 专家（执行）===' : '=== 导入 WorkBuddy 专家（DRY-RUN）===')

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const all = manifest.experts

  // 筛选
  const selected = all.filter(e => {
    if (WANT_CATS.has(e.categoryId)) return true
    const text = `${getText(e.profession)} ${getText(e.description)}`
    return DOC_KEYWORDS.some(kw => text.includes(kw))
  })
  console.log(`筛选 ${selected.length} / ${all.length} 个专家\n`)

  // 登录
  const lg = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin-demo@aipaddle.net', password: env.SEED_PASSWORD }),
  })
  if (lg.status !== 200) { console.error('登录失败', lg.status); process.exit(1) }

  // 查已有 Agent，避免重复
  const existing = await api('/api/agents')
  const existNames = new Set((existing.body?.agents ?? []).map(a => a.name))

  let created = 0, skipped = 0, failed = 0
  for (const e of selected) {
    const name = getText(e.displayName) || getText(e.profession) || e.id
    const profession = getText(e.profession)
    const desc = getText(e.description)
    const initPrompt = getText(e.defaultInitPrompt)
    const department = CAT_MAP[e.categoryId] || e.categoryId
    const tags = (e.tags || []).map(t => getText(t)).filter(Boolean)

    // 系统提示词：用描述 + 职业 + 初始提示词拼接
    const systemPrompt = [
      `你是${profession}「${name}」。`,
      desc,
      initPrompt ? `\n用户可能会这样向你提问：${initPrompt}` : '',
      tags.length > 0 ? `\n你的专长领域：${tags.join('、')}` : '',
    ].filter(Boolean).join('\n')

    if (existNames.has(name)) {
      skipped++
      continue
    }

    if (!APPLY) {
      console.log(`  [dry] ${name.padEnd(16)} ${profession.padEnd(18)} [${department}]`)
      created++
      continue
    }

    const r = await api('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        name,
        department,
        description: `${profession}${desc ? '：' + desc : ''}`,
        systemPrompt,
      }),
    })
    if (r.status === 201) {
      created++
      existNames.add(name)
    } else {
      failed++
      console.log(`  ❌ ${name}: ${r.status} ${r.body?.error?.message ?? ''}`)
    }
  }

  console.log(`\n${APPLY ? '已创建' : '待创建'} ${created}　跳过(已存在) ${skipped}　失败 ${failed}`)
  if (!APPLY) console.log('\nDRY-RUN 结束。加 --apply 执行。')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
