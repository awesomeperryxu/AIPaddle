#!/usr/bin/env node
/**
 * 修复从 WorkBuddy 导入的 Agent config：
 * 1. systemPrompt 写入 config（导入时传错位置）
 * 2. plugin 依赖写入 config.requiredPlugins（供编排页依赖检测）
 *
 * 直接操作 Supabase（service_role），不依赖 AIPaddle API 登录。
 *
 * 用法：
 *   node scripts/fix-imported-agents-config.mjs           # dry-run
 *   node scripts/fix-imported-agents-config.mjs --apply    # 执行
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const MANIFEST = path.join(process.env.HOME, '.workbuddy/app/cache/experts/manifest.json')

// 读 .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function getText(v, lang = 'zh') {
  if (!v) return ''
  if (typeof v === 'string') return v
  return v[lang] || v.en || v.zh || ''
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 读 WorkBuddy manifest
console.log('读取 WorkBuddy manifest...')
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const expertsByName = new Map()
for (const e of manifest.experts) {
  const name = getText(e.displayName) || getText(e.profession) || e.id
  expertsByName.set(name, e)
}
console.log(`  manifest 共 ${manifest.experts.length} 个专家，索引 ${expertsByName.size} 个名称\n`)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('读取全部 Agent...')
const { data: agents, error } = await supabase
  .from('agents')
  .select('id, name, description, config')
  .is('deleted_at', null)
  .order('name')
if (error) { console.error('查询失败:', error.message); process.exit(1) }
console.log(`共 ${agents.length} 个 Agent\n`)

let fixed = 0, skipped = 0, noMatch = 0, failed = 0

for (const a of agents) {
  const config = a.config ?? {}
  const expert = expertsByName.get(a.name)
  if (!expert) {
    noMatch++
    continue
  }

  // 检查是否需要修复
  const hasPrompt = config.systemPrompt && String(config.systemPrompt).trim().length > 0
  const hasPluginDep = Array.isArray(config.requiredPlugins) && config.requiredPlugins.length > 0
  if (hasPrompt && hasPluginDep) {
    skipped++
    continue
  }

  // 重建 systemPrompt
  const profession = getText(expert.profession)
  const desc = getText(expert.description)
  const initPrompt = getText(expert.defaultInitPrompt)
  const tags = (expert.tags || []).map(t => getText(t)).filter(Boolean)
  const systemPrompt = [
    `你是${profession}「${a.name}」。`,
    desc,
    initPrompt ? `\n用户可能会这样向你提问：${initPrompt}` : '',
    tags.length > 0 ? `\n你的专长领域：${tags.join('、')}` : '',
  ].filter(Boolean).join('\n')

  // plugin 依赖
  const pluginId = typeof expert.plugin === 'string' ? expert.plugin : ''
  const requiredPlugins = pluginId ? [{ id: pluginId, name: pluginId, source: 'workbuddy' }] : []

  // quickPrompts → suggestedQuestions
  const quickPrompts = (expert.quickPrompts || []).map(q => getText(q)).filter(Boolean)

  const newConfig = {
    ...config,
    ...(hasPrompt ? {} : { systemPrompt }),
    ...(hasPluginDep ? {} : { requiredPlugins }),
    ...(quickPrompts.length > 0 && !(config.suggestedQuestions?.length > 0) ? { suggestedQuestions: quickPrompts.slice(0, 5) } : {}),
  }

  const changes = []
  if (!hasPrompt) changes.push('systemPrompt')
  if (!hasPluginDep && requiredPlugins.length > 0) changes.push(`plugin:${pluginId}`)
  if (quickPrompts.length > 0 && !(config.suggestedQuestions?.length > 0)) changes.push(`${quickPrompts.length} 建议问题`)

  if (!APPLY) {
    console.log(`  [dry] ${a.name.padEnd(24)} → ${changes.join(', ')}`)
    fixed++
    continue
  }

  const { error: updateErr } = await supabase
    .from('agents')
    .update({ config: newConfig })
    .eq('id', a.id)
  if (updateErr) {
    console.log(`  ❌ ${a.name}: ${updateErr.message}`)
    failed++
  } else {
    console.log(`  ✅ ${a.name} (${changes.join(', ')})`)
    fixed++
  }
}

console.log(`\n结果：修复 ${fixed}，跳过 ${skipped}，无匹配 ${noMatch}，失败 ${failed}`)
if (!APPLY && fixed > 0) console.log('\n这是 dry-run，加 --apply 执行修复')
