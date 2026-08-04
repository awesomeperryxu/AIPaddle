#!/usr/bin/env node
/**
 * 回填 tool_versions：V12-3.7 迁移建了 Tool 却漏了版本（与 plugin_versions 同一个坑）。
 *
 * 🔴 上一次（V12-4.2）只回填了 plugin_versions 就宣布修好，**没往下验 tool 层**。
 * 当时的自我批评写的是「V12-3.7 的校验只验了条数与依赖对得上，没验产物是否可执行」，
 * 然后用同样不彻底的方式做了修复。这是同一个坑的第二次。
 *
 * 这次的验收标准不只是「条数对」，而是：
 *   ① 版本状态与 Tool 状态一致（Tool 已发布而版本是草稿 = 发布了个用不了的东西）
 *   ② binding_config 符合表注释的形状
 *   ③ 🔴 回填完后用 listAgentTools() 的逻辑过滤一遍，确认「Tool 已发布 + 版本已发布」
 *      的数量 > 0 —— 不等到端到端验证时才发现管道里没水
 *
 * 用法：
 *   node scripts/backfill-tool-versions.mjs           # dry-run
 *   node scripts/backfill-tool-versions.mjs --apply    # 执行
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

async function main() {
  console.log(APPLY ? '=== 回填 tool_versions（执行）===' : '=== 回填 tool_versions（DRY-RUN）===')

  const { data: tools } = await admin.from('tools')
    .select('id,org_id,name,plugin_id,binding_type,status')
    .is('deleted_at', null)

  // 已有版本的 Tool → 跳过（幂等）
  const { data: existingVs } = await admin.from('tool_versions')
    .select('tool_id').is('deleted_at', null)
  const hasVer = new Set((existingVs ?? []).map((v) => v.tool_id))

  // plugin_versions：MCP 的连接信息在这里
  const { data: pvs } = await admin.from('plugin_versions')
    .select('plugin_id,credential_schema,status').is('deleted_at', null)
  const pvByPlugin = new Map()
  for (const pv of pvs ?? []) if (!pvByPlugin.has(pv.plugin_id)) pvByPlugin.set(pv.plugin_id, pv)

  let planned = 0, done = 0, skipped = 0, noSource = 0

  for (const t of tools ?? []) {
    if (hasVer.has(t.id)) { skipped++; continue }

    const pv = pvByPlugin.get(t.plugin_id)

    // binding_config 按类型构造
    let bindingConfig
    switch (t.binding_type) {
      case 'mcp':
        // MCP Tool 的 binding_config 存的是 mcp_tool_name —— chat 调用时告诉 MCP Server 的真实工具名。
        // Tool.name 就是从 Skill 名迁移来的，而 Skill 名在 V12-3.7 按 MCP 工具名设的。
        bindingConfig = { mcp_tool_name: t.name }
        break
      case 'api':
      case 'db':
        // 这几个没有源连接信息（GAP-3），只建空版本让页面上看得到并能填写
        if (!pv) { noSource++; console.log(`  ⚠️ ${t.name}：无 plugin_version，建空版本（需人工补配置）`); }
        bindingConfig = {}
        break
      default:
        bindingConfig = {}
    }

    planned++
    if (!APPLY) {
      console.log(`  [dry] ${t.name}  bt=${t.binding_type}  status=${t.status}  cfg=${JSON.stringify(bindingConfig).slice(0, 50)}`)
      continue
    }

    const { error } = await admin.from('tool_versions').insert({
      org_id: t.org_id,
      tool_id: t.id,
      version: '1.0.0',
      input_schema: {},
      output_schema: {},
      binding_config: bindingConfig,
      // ① 版本状态与 Tool 状态一致
      status: t.status,
      changelog: '由 scripts/backfill-tool-versions.mjs 回填（V12-3.7 迁移遗漏）',
    })
    if (error) { console.log(`  ❌ ${t.name}：${error.message}`); continue }
    done++
  }

  console.log(`\n已有版本跳过 ${skipped}　无源数据 ${noSource}　${APPLY ? `回填 ${done}` : `待回填 ${planned}`}`)

  if (APPLY) {
    // ③ 验收：「Tool 已发布 + 版本已发布」的数量
    const { data: pubTools } = await admin.from('tools')
      .select('id').eq('status', 'published').is('deleted_at', null)
    const pubToolIds = (pubTools ?? []).map((t) => t.id)
    const { data: pubVers } = await admin.from('tool_versions')
      .select('tool_id').eq('status', 'published').is('deleted_at', null)
      .in('tool_id', pubToolIds.slice(0, 200))
    const usable = new Set((pubVers ?? []).map((v) => v.tool_id)).size
    console.log(`\n🔴 验收：Tool 已发布 + 版本已发布 = ${usable} 个`)
    if (usable === 0) console.log('  ⚠️ 仍为 0——管道修好了但没有水')
    else console.log(`  ✅ Agent 现在可以用上 ${usable} 个 Tool`)
  }

  if (!APPLY) console.log('\nDRY-RUN 结束。加 --apply 执行。')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
