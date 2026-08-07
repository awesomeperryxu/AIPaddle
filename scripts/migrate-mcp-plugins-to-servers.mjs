#!/usr/bin/env node
/**
 * 把 MCP Plugin 迁成 MCP Server（ADR-024）。
 *
 * 背景：MCP 规范中客户端不预注册 tools，Server 经 tools/list 动态提供。
 * 此前把 MCP 套进为 API/DB 设计的 Plugin+Tool 模型，导致：
 *   - 22 个 MCP「Plugin」其实每个都是一个 MCP Server（含 VibeStudio 这类，
 *     经逐个核对 repo 确认全部是真 MCP Server，不是别的东西）
 *   - 164 条 binding_type='mcp' 的 Tool 记录是手工维护的静态副本，
 *     无来源、无调用路径（run.ts 没有 case 'mcp'）
 *
 * 🔴 禁止占位：迁移只搬真实信息（名称/说明/来源仓库）。endpoint 拿不到就留空并
 * 标为待填，绝不编造地址——已有 8 个经联网查证的真实端点在上一轮配好，不覆盖它们。
 *
 * 用法：
 *   node scripts/migrate-mcp-plugins-to-servers.mjs           # dry-run
 *   node scripts/migrate-mcp-plugins-to-servers.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/** 按 repo 归类部署形态——决定 mcp_servers.type 与是否可能有公网 endpoint */
function classify(repo) {
  if (!repo) return { type: 'enterprise', note: '企业内部服务，地址需人工填写' }
  if (/official remote|^linear/i.test(repo)) return { type: 'third_party', note: '官方远程' }
  return { type: 'third_party', note: '开源自建，需自行部署后填地址' }
}

async function main() {
  console.log(APPLY ? '=== MCP Plugin → Server 迁移（执行）===\n' : '=== MCP Plugin → Server 迁移（DRY-RUN）===\n')

  const { data: plugins } = await db.from('plugins')
    .select('id,name,description,repo,org_id,status').eq('provider_type', 'mcp').is('deleted_at', null)
  const { data: servers } = await db.from('mcp_servers').select('id,name,org_id,endpoint').is('deleted_at', null)
  const byName = new Map((servers ?? []).map((s) => [`${s.org_id}::${s.name}`, s]))

  const toCreate = [], toEnrich = []
  for (const p of plugins ?? []) {
    const exist = byName.get(`${p.org_id}::${p.name}`)
    if (exist) toEnrich.push({ plugin: p, server: exist })
    else toCreate.push(p)
  }

  console.log(`MCP Plugin 共 ${plugins?.length ?? 0} 个；已有同名 Server ${toEnrich.length} 个\n`)
  console.log(`① 新建 Server（endpoint 留空待填）: ${toCreate.length}`)
  for (const p of toCreate) console.log(`   ${p.name.padEnd(30)} ${classify(p.repo).note}`)
  console.log(`\n② 已有 Server，仅补说明: ${toEnrich.length}`)
  for (const e of toEnrich) console.log(`   ${e.server.name.padEnd(30)} endpoint=${e.server.endpoint || '(空)'}`)

  const { data: mcpTools } = await db.from('tools').select('id').eq('binding_type', 'mcp').is('deleted_at', null)
  console.log(`\n③ 删除静态 Tool 记录: ${mcpTools?.length ?? 0} 条（tools 改为 tools/list 实时拉取）`)
  console.log(`④ 删除 MCP Plugin 记录: ${plugins?.length ?? 0} 个（MCP 不再有 Plugin 层）`)

  if (!APPLY) { console.log('\nDRY-RUN 结束。加 --apply 执行。'); return }

  console.log('\n=== 执行 ===')
  let created = 0
  for (const p of toCreate) {
    const { type, note } = classify(p.repo)
    const { data: anyUser } = await db.from('users').select('id').eq('org_id', p.org_id).limit(1).maybeSingle()
    const { error } = await db.from('mcp_servers').insert({
      org_id: p.org_id, created_by: anyUser?.id, name: p.name,
      // 保留真实来源信息，便于人工去找部署地址；绝不编造 endpoint
      description: [p.description, p.repo ? `来源仓库：${p.repo}` : '', note].filter(Boolean).join(' | '),
      type,
      endpoint: '',            // 🔴 留空 = 如实标记「待填」，而非占位假地址
      auth_type: 'api_key',
      status: 'draft',         // 自动创建一律草稿，不得自动 approve
    })
    if (error) { console.log(`  ❌ ${p.name}: ${error.message}`); continue }
    created++
  }
  console.log(`① 新建 ${created} 个 Server`)

  let enriched = 0
  for (const e of toEnrich) {
    const { error } = await db.from('mcp_servers')
      .update({ description: [e.plugin.description, e.plugin.repo ? `来源仓库：${e.plugin.repo}` : ''].filter(Boolean).join(' | '), updated_at: new Date().toISOString() })
      .eq('id', e.server.id)
    if (!error) enriched++
  }
  console.log(`② 补充 ${enriched} 个 Server 的说明`)

  const now = new Date().toISOString()
  const { count: delTools } = await db.from('tools')
    .update({ deleted_at: now }, { count: 'exact' }).eq('binding_type', 'mcp').is('deleted_at', null)
  console.log(`③ 删除 ${delTools ?? 0} 条静态 MCP Tool 记录`)

  const { count: delPlugins } = await db.from('plugins')
    .update({ deleted_at: now }, { count: 'exact' }).eq('provider_type', 'mcp').is('deleted_at', null)
  console.log(`④ 删除 ${delPlugins ?? 0} 个 MCP Plugin 记录`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
