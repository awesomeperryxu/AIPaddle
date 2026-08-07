#!/usr/bin/env node
/**
 * MCP 存量数据订正（ADR-023）。
 *
 * 背景：32 个 provider_type='mcp' 的 Plugin 全部已发布，但 mcp_servers 表 0 条——
 * 没有一个能真正连通。110 个 Agent 的 requiredPlugins 声明则是导入错误：
 * WorkBuddy 专家的 `plugin` 字段是**它自己的包名**（329/426 与 agentName 相同），
 * 被当成了「依赖的插件」，于是提示「需要 invoice-verify-expert」而那就是它自己的名字。
 *
 * 🔴 铁律：坚决禁止占位。本脚本只写**联网查证过的真实 endpoint**；
 * 拿不到真实地址的一律不建 Server，而不是造一个假的。
 *
 * 用法：
 *   node scripts/sync-mcp-servers.mjs            # dry-run，只报告
 *   node scripts/sync-mcp-servers.mjs --apply    # 执行
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── 已联网查证的官方远程 MCP 端点（2026-08-07）────────────────────
// 每条都来自厂商官方文档或官方仓库 README，非推测。
// 新增条目前必须先查证，宁可不加也不猜。
const VERIFIED_ENDPOINTS = {
  'Notion':     { match: /Notion/i,            url: 'https://mcp.notion.com/mcp',              auth: 'oauth', src: 'developers.notion.com' },
  'Linear':     { match: /Linear/i,            url: 'https://mcp.linear.app/mcp',              auth: 'oauth', src: 'linear.app/docs/mcp' },
  'Sentry':     { match: /Sentry/i,            url: 'https://mcp.sentry.dev/mcp',              auth: 'oauth', src: 'blog.sentry.io' },
  'Stripe':     { match: /Stripe/i,            url: 'https://mcp.stripe.com',                  auth: 'oauth', src: 'github.com/mcp/com.stripe' },
  'Atlassian':  { match: /Jira|Confluence/i,   url: 'https://mcp.atlassian.com/v1/mcp/authv2', auth: 'oauth', src: 'github.com/atlassian/atlassian-mcp-server' },
  'Cloudflare': { match: /Cloudflare/i,        url: 'https://mcp.cloudflare.com/mcp',          auth: 'oauth', src: 'developers.cloudflare.com/agents' },
  'GitHub':     { match: /GitHub|代码仓库协作/i, url: 'https://api.githubcopilot.com/mcp/',      auth: 'oauth', src: 'github.com/github/github-mcp-server' },
  // 系统内已有的真实地址：来自「票证核验专家」的 credentialGuide
  '汇联易':      { match: /汇联易|Helios|发票查验/i, url: 'https://hlymcp.huilianyi.com:8443/mcp', auth: 'api_key', src: 'agent.config.credentialGuide' },
}

// 本地进程型 MCP：以 npx/node 在客户端起进程，**没有 endpoint**。
// 与服务端多租户平台形态不兼容——不是数据缺失，是架构上无法接入。按用户指令删除。
const LOCAL_PROCESS = /modelcontextprotocol\/servers|playwright-mcp|excel-mcp-server|firecrawl-mcp-server|brave-search-mcp-server/i

async function main() {
  console.log(APPLY ? '=== MCP 存量订正（执行）===' : '=== MCP 存量订正（DRY-RUN）===\n')

  const { data: plugins } = await db.from('plugins')
    .select('id,name,repo,org_id,status').eq('provider_type', 'mcp').is('deleted_at', null)

  const toConfigure = [], toDelete = [], toKeep = []
  for (const p of plugins ?? []) {
    const hit = Object.entries(VERIFIED_ENDPOINTS).find(([, v]) => v.match.test(p.name))
    if (hit) { toConfigure.push({ plugin: p, vendor: hit[0], ...hit[1] }); continue }
    if (LOCAL_PROCESS.test(p.repo ?? '')) { toDelete.push(p); continue }
    toKeep.push(p)   // 需自建部署 / 企业内部服务：保留 Plugin，不建空 Server
  }

  console.log(`① 可配置真实 endpoint : ${toConfigure.length}`)
  for (const c of toConfigure) console.log(`   ${c.plugin.name.padEnd(28)} → ${c.url}  [${c.src}]`)
  console.log(`\n② 本地进程型，删除     : ${toDelete.length}`)
  for (const p of toDelete) console.log(`   ${p.name.padEnd(28)} repo=${p.repo}`)
  console.log(`\n③ 保留待部署/待填写   : ${toKeep.length}（不建空 Server，页面标注需自行部署）`)
  for (const p of toKeep) console.log(`   ${p.name.padEnd(28)} repo=${p.repo ?? '(内部服务)'}`)

  // 错误的依赖声明：WorkBuddy 专家包名被当成依赖
  const { data: agents } = await db.from('agents').select('id,name,config').is('deleted_at', null)
  const badDeps = (agents ?? []).filter(a => Array.isArray(a.config?.requiredPlugins) && a.config.requiredPlugins.length)
  console.log(`\n④ 清除错误依赖声明     : ${badDeps.length} 个 Agent 的 requiredPlugins`)
  console.log('   （WorkBuddy 专家的 plugin 字段是自身包名，非依赖——导入时理解错误）')

  if (!APPLY) { console.log('\nDRY-RUN 结束。加 --apply 执行。'); return }

  console.log('\n=== 执行 ===')
  let ok = 0
  for (const c of toConfigure) {
    const { data: exist } = await db.from('mcp_servers')
      .select('id').eq('org_id', c.plugin.org_id).eq('name', c.plugin.name).maybeSingle()
    if (exist) {
      await db.from('mcp_servers').update({ endpoint: c.url, auth_type: c.auth, updated_at: new Date().toISOString() }).eq('id', exist.id)
    } else {
      const { data: anyUser } = await db.from('users').select('id').eq('org_id', c.plugin.org_id).limit(1).maybeSingle()
      const { error } = await db.from('mcp_servers').insert({
        org_id: c.plugin.org_id, created_by: anyUser?.id, name: c.plugin.name,
        description: `官方远程 MCP（来源：${c.src}）`,
        type: 'third_party', endpoint: c.url, auth_type: c.auth,
        // 🔴 一律 draft：自动创建不得自动 approve，那等于系统给自己开通往外部的连接
        status: 'draft',
      })
      if (error) { console.log(`  ❌ ${c.plugin.name}: ${error.message}`); continue }
    }
    ok++
  }
  console.log(`① 已配置 ${ok} 个 MCP Server（草稿态，待人工审批）`)

  const now = new Date().toISOString()
  let del = 0
  for (const p of toDelete) {
    const { error } = await db.from('plugins').update({ deleted_at: now }).eq('id', p.id)
    if (!error) del++
    // 级联：该 Plugin 下的 Tool 一并软删，避免留下指向已删 Plugin 的孤儿
    await db.from('tools').update({ deleted_at: now }).eq('plugin_id', p.id).is('deleted_at', null)
  }
  console.log(`② 已删除 ${del} 个本地进程型 Plugin（含其 Tool）`)

  let cleaned = 0
  for (const a of badDeps) {
    const cfg = { ...a.config }
    delete cfg.requiredPlugins
    const { error } = await db.from('agents').update({ config: cfg, updated_at: now }).eq('id', a.id)
    if (!error) cleaned++
  }
  console.log(`④ 已清除 ${cleaned} 个 Agent 的错误依赖声明`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
