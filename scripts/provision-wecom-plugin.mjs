#!/usr/bin/env node
/**
 * V12-4.7：把企业微信自建应用开通成一个受治理的 Plugin/Tool 实例。
 *
 * 建出来的东西：
 *   credentials(kind=api_key)   ← CorpSecret 密文
 *   plugins(provider_type=api)  ← 「企业微信自建应用」
 *   plugin_versions             ← base_url
 *   tools(binding_type=native)  ← wecom_app_message
 *   tool_versions               ← handler_id=wecom.app_message + corp_id/agent_id/to_user
 *
 * 🔴 为什么 Tool 是 native 而不是 api：
 * 企微要两步（gettoken → send）、token 走 query string、且必须缓存。
 * 现有 API Binding 是「一个 endpoint + Bearer 凭证」的模型，装不下这套流程。
 * PRD 给的位置就是 native = 平台注册的内置 Handler（见 lib/tools/handlers.ts）。
 *
 * 🔴 前置：服务器必须已配置 MODEL_KEY_ENC_SECRET（见 ISSUES.md GAP-5），
 * 否则凭证写不进去，脚本会直接退出而不是建出一个没有凭证的空壳。
 *
 * 用法：
 *   WECOM_CORP_ID=.. WECOM_AGENT_ID=.. WECOM_CORP_SECRET=.. node scripts/provision-wecom-plugin.mjs
 *   加 --apply 才真正写库（默认 dry-run）
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

const CORP_ID = process.env.WECOM_CORP_ID
const AGENT_ID = process.env.WECOM_AGENT_ID
const CORP_SECRET = process.env.WECOM_CORP_SECRET
const TO_USER = process.env.WECOM_TO_USER || '@all'
// tenants 表的租户标识列是 code，不是 slug（写这行时凭直觉猜成 slug，实测才发现）
const ORG_CODE = process.env.PROVISION_ORG || 'royalblack'

const log = (s) => console.log(s)

function bail(msg) { console.error(`❌ ${msg}`); process.exit(1) }

if (!CORP_ID || !AGENT_ID || !CORP_SECRET) {
  bail('缺少 WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_CORP_SECRET')
}
if (!process.env.MODEL_KEY_ENC_SECRET) {
  // 不建空壳：没有加密密钥就存不了 CorpSecret，建出来的 Plugin 调不通，
  // 而"存在但不可用"比"不存在"更难排查
  bail('未配置 MODEL_KEY_ENC_SECRET —— 凭证无法加密存储，拒绝建出不可用的 Plugin（见 ISSUES.md GAP-5）')
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function main() {
  log(APPLY ? '=== 开通企微 Plugin（执行）===' : '=== 开通企微 Plugin（DRY-RUN）===')

  const { data: org } = await admin.from('tenants').select('id,name').eq('code', ORG_CODE).maybeSingle()
  if (!org) bail(`找不到租户 code=${ORG_CODE}`)
  log(`租户：${org.name}（${org.id}）`)

  // 幂等：同名 Plugin 已存在则不重复建
  const PLUGIN_NAME = '企业微信自建应用'
  const { data: existing } = await admin.from('plugins')
    .select('id').eq('org_id', org.id).eq('name', PLUGIN_NAME).is('deleted_at', null).maybeSingle()
  if (existing) {
    log(`✅ Plugin 已存在（${existing.id}），无需重复开通`)
    return
  }

  log('\n将创建：')
  log(`  凭证      kind=api_key  name=企微 CorpSecret（密文，明文不入库）`)
  log(`  Plugin    ${PLUGIN_NAME}  provider_type=api`)
  log(`  Tool      wecom_app_message  binding_type=native  risk=medium`)
  log(`  配置      corp_id=${CORP_ID}  agent_id=${AGENT_ID}  to_user=${TO_USER}`)
  log(`  🔴 CorpSecret 只进 credentials 密文列，binding_config 里不含任何凭证`)

  if (!APPLY) { log('\nDRY-RUN 结束。加 --apply 执行。'); return }

  // 凭证：走应用自己的加密函数，保证与运行时解密一致
  const { encryptApiKey } = await import('../lib/crypto/api-key.ts').catch(() => ({}))
  if (!encryptApiKey) {
    bail('无法加载加密函数——请改用应用内「凭证管理」页面创建凭证后，再以 --credential-id 重跑')
  }

  const { data: cred, error: credErr } = await admin.from('credentials').insert({
    org_id: org.id, name: '企微 CorpSecret', kind: 'api_key',
    secret_ciphertext: encryptApiKey(CORP_SECRET), enabled: true,
  }).select('id').single()
  if (credErr) bail(`建凭证失败：${credErr.message}`)

  const { data: plugin, error: pErr } = await admin.from('plugins').insert({
    org_id: org.id, name: PLUGIN_NAME, provider_type: 'api',
    description: '企业微信自建应用消息推送。可信 IP 需包含生产服务器出口 IP。',
    status: 'draft', origin: 'user',
  }).select('id').single()
  if (pErr) bail(`建 Plugin 失败：${pErr.message}`)

  await admin.from('plugin_versions').insert({
    org_id: org.id, plugin_id: plugin.id, version: '1.0.0',
    base_url: 'https://qyapi.weixin.qq.com', status: 'draft',
    changelog: '由 scripts/provision-wecom-plugin.mjs 开通',
  })

  const { data: tool, error: tErr } = await admin.from('tools').insert({
    org_id: org.id, plugin_id: plugin.id, name: 'wecom_app_message',
    display_name: '企微应用消息推送', binding_type: 'native', risk_level: 'medium', status: 'draft',
  }).select('id').single()
  if (tErr) bail(`建 Tool 失败：${tErr.message}`)

  const { error: tvErr } = await admin.from('tool_versions').insert({
    org_id: org.id, tool_id: tool.id, version: '1.0.0', credential_id: cred.id,
    binding_config: {
      handler_id: 'wecom.app_message',
      corp_id: CORP_ID, agent_id: AGENT_ID, to_user: TO_USER,
    },
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string', description: 'markdown 消息正文' } },
      required: ['content'],
    },
    status: 'draft',
    changelog: '由 scripts/provision-wecom-plugin.mjs 开通',
  })
  if (tvErr) bail(`建 Tool 版本失败：${tvErr.message}`)

  log(`\n✅ 已开通。Plugin=${plugin.id}  Tool=${tool.id}`)
  log('   均为草稿态，需在页面提交审核并发布后才能被调用。')
  log('   发布前建议先在 Plugin → Tool 列表点「测试」确认连通（只取 token，不会发消息）。')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
