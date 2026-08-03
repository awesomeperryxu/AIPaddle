#!/usr/bin/env node
/**
 * V12-4.2 前置：回填 plugin_versions。
 *
 * 🔴 补 V12-3.7 的缺口：那次迁移建了 Plugin 与 Tool，**漏了 plugin_versions**。
 * 而连接配置（command / transport / remote_url / credential_schema）全在版本表里——
 * 缺了它，迁移来的 33 个 Plugin 只是「有名字的壳」，MCP 根本调不通。
 *
 * 这个缺口在 V12-3.7 当时不显形：那一步只验了「Skill 条数不变、依赖数对得上」，
 * 没验「迁移产物是否可执行」。可执行性要到接入调用链路（本任务）才暴露。
 *
 * 数据来源：源 Skill 的 config（迁移时刻意保留未清，正是为了这类回补）。
 *
 * 用法：
 *   node scripts/backfill-plugin-versions.mjs           # dry-run
 *   node scripts/backfill-plugin-versions.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const log = (s) => console.log(s)

async function main() {
  log(APPLY ? '=== 回填 plugin_versions（执行）===' : '=== 回填 plugin_versions（DRY-RUN）===')

  // 迁移来的 Plugin 与源 Skill 同名（V12-3.7 的映射规则）
  const { data: plugins } = await admin.from('plugins')
    .select('id,org_id,name,provider_type,status').is('deleted_at', null)
  const { data: skills } = await admin.from('skills')
    .select('id,name,config,org_id').is('deleted_at', null)
  const skillByKey = new Map((skills ?? []).map((s) => [`${s.org_id}::${s.name}`, s]))

  let planned = 0, done = 0, skipped = 0, noSource = 0
  for (const p of plugins ?? []) {
    const { count } = await admin.from('plugin_versions')
      .select('id', { count: 'exact', head: true })
      .eq('plugin_id', p.id).is('deleted_at', null)
    if ((count ?? 0) > 0) { skipped++; continue }   // 幂等：已有版本则跳过

    const src = skillByKey.get(`${p.org_id}::${p.name}`)
    const c = src?.config ?? {}
    const hasConn = c.command || c.remote_url || c.base_url || c.mcp_server_id
    if (!hasConn) {
      noSource++
      log(`  ⚠️ ${p.name}：源 config 无连接信息，跳过（需人工在 Plugin 页补全）`)
      continue
    }

    planned++
    if (!APPLY) { log(`  [dry] ${p.name} → command=${c.command ?? '(无)'} transport=${c.transport ?? '(无)'}`); continue }

    const { error } = await admin.from('plugin_versions').insert({
      org_id: p.org_id,
      plugin_id: p.id,
      version: '1.0.0',
      command: c.command ?? null,
      transport: c.transport ?? null,
      remote_url: c.remote_url ?? null,
      base_url: c.base_url ?? null,
      // env 数组声明「需要哪些凭证字段」——只记字段名，绝不含值
      credential_schema: Array.isArray(c.env) && c.env.length > 0
        ? { required: c.env } : {},
      changelog: '由 V12-3.7 迁移数据回填（scripts/backfill-plugin-versions.mjs）',
      // 版本状态跟随 Plugin：Plugin 已发布而版本是草稿，等于发布了个用不了的东西
      status: p.status,
    })
    if (error) { log(`  ❌ ${p.name}：${error.message}`); continue }
    done++
  }

  log('')
  log(`已有版本跳过 ${skipped}　无源数据 ${noSource}　${APPLY ? `回填 ${done}` : `待回填 ${planned}`}`)
  if (!APPLY) log('\nDRY-RUN 结束。加 --apply 执行。')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
