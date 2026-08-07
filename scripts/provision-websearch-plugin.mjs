#!/usr/bin/env node
/**
 * WF-23：把「联网搜索」开通成受治理的 Plugin → Tool → Skill 链路。
 *
 * 建出来的东西：
 *   credentials(kind=api_key)        ← Google AI Studio API Key 密文
 *   plugins(provider_type=api)       ← 「联网搜索（Google）」
 *   plugin_versions                  ← base_url
 *   tools(binding_type=native)       ← web_search
 *   tool_versions                    ← handler_id=websearch.google + input_schema{query}
 *   skills(type=API)                 ← 「联网搜索」——**工作流的 tool 节点引用的是 Skill**
 *   skill_plugin_dependencies        ← Skill → Tool（object_type='tool'）
 *
 * 🔴 为什么必须一路建到 Skill：workflow 的 tool 节点 config.tool_id 指向的是 Skill，
 * 由 Skill 经 skill_plugin_dependencies 找到 Tool（见 lib/workflow/tool-node.ts）。
 * 只建到 Tool 的话，Copilot 的可用能力清单里根本看不到它，编排不出来。
 *
 * 🔴 为什么 Tool 是 native 而不是 api：响应要解析 groundingMetadata 取来源 URL，
 * 通用 API Binding 只会把响应体整段回传，来源就散在一坨 JSON 里交给下游模型自己认。
 * 来源可核对是这条能力的意义所在，所以走内置 Handler（lib/tools/handlers.ts）。
 *
 * 🔴 API Key 只进 credentials 密文列，绝不写进代码、脚本或 git。
 *
 * 用法：
 *   GOOGLE_AI_API_KEY=xxx node scripts/provision-websearch-plugin.mjs           # dry-run
 *   GOOGLE_AI_API_KEY=xxx node scripts/provision-websearch-plugin.mjs --apply   # 真写库
 *   PROVISION_ORG=<租户code> 指定租户（默认 royalblack）
 *
 * 建出来都是草稿态：需在页面提交审核并发布后才能被调用（ADR-005，AI/脚本不越过审核）。
 */
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
// 逃生口：已在「凭证管理」页面建好凭证时，直接复用它，跳过本脚本的加密
const CRED_ID_ARG = (process.argv.find((a) => a.startsWith('--credential-id=')) ?? '').split('=')[1]

// 🔴 凭证加密：与 lib/crypto/model-key.ts 逐行对齐（AES-256-GCM，格式 v1:iv:tag:ct，
// 主密钥 hex64 直用、否则 sha256 派生）。**不能 import 那个模块** —— 它是 .ts 且带
// `import 'server-only'`，node 直接跑会 MODULE_NOT_FOUND（实测踩到）。
// 复刻的风险是「格式改了这里不知道」，所以下面加密完立刻自解密比对，对不上就中止，
// 绝不写入一条解不开的凭证——那种凭证在页面上看着正常，一调用才失败。
function masterKey() {
  const raw = process.env.MODEL_KEY_ENC_SECRET
  if (!raw) return null
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return createHash('sha256').update(raw).digest()
}

function encryptApiKey(plaintext) {
  const key = masterKey()
  if (!key) throw new Error('未配置 MODEL_KEY_ENC_SECRET')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`
}

function decryptApiKey(ciphertext) {
  const key = masterKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('密文格式非法')
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'))
  d.setAuthTag(Buffer.from(parts[2], 'base64'))
  return Buffer.concat([d.update(Buffer.from(parts[3], 'base64')), d.final()]).toString('utf8')
}

/** 加密并当场验证能解回原文，对不上就中止 */
function encryptVerified(plaintext) {
  const ct = encryptApiKey(plaintext)
  if (decryptApiKey(ct) !== plaintext) {
    throw new Error('凭证加密自校验失败——加密格式可能已与 lib/crypto/model-key.ts 不一致，请对齐后重试')
  }
  return ct
}

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const API_KEY = process.env.GOOGLE_AI_API_KEY
const ORG_CODE = process.env.PROVISION_ORG || 'royalblack'
const SEARCH_MODEL = process.env.WEBSEARCH_MODEL || 'gemini-flash-latest'

const log = (s) => console.log(s)
function bail(msg) { console.error(`❌ ${msg}`); process.exit(1) }

if (!API_KEY) bail('缺少 GOOGLE_AI_API_KEY（Google AI Studio 的 API Key）')
// 不建空壳：没有加密密钥就存不了 Key，建出来的能力调不通，
// 而「存在但不可用」比「不存在」更难排查。
// 只在 --apply 时要求——dry-run 不写库，本地没这个密钥也该能先看清要建什么。
if (APPLY && !process.env.MODEL_KEY_ENC_SECRET) {
  bail('未配置 MODEL_KEY_ENC_SECRET —— 凭证无法加密存储，拒绝建出不可用的 Plugin（该密钥只在服务器上，请在服务器执行本脚本）')
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const PLUGIN_NAME = '联网搜索（Google）'
const SKILL_NAME = '联网搜索'

async function main() {
  log(APPLY ? '=== 开通联网搜索能力（执行）===' : '=== 开通联网搜索能力（DRY-RUN）===')

  const { data: org } = await admin.from('tenants').select('id,name').eq('code', ORG_CODE).maybeSingle()
  if (!org) bail(`找不到租户 code=${ORG_CODE}`)
  log(`租户：${org.name}（${org.id}）`)

  // 幂等：同名 Plugin 已存在则不重复建
  const { data: existing } = await admin.from('plugins')
    .select('id').eq('org_id', org.id).eq('name', PLUGIN_NAME).is('deleted_at', null).maybeSingle()
  if (existing) {
    log(`✅ Plugin 已存在（${existing.id}），无需重复开通`)
    return
  }

  log('\n将创建：')
  log('  凭证      kind=api_key  name=Google AI API Key（密文，明文不入库）')
  log(`  Plugin    ${PLUGIN_NAME}  provider_type=api`)
  log(`  Tool      web_search  binding_type=native  handler=websearch.google  model=${SEARCH_MODEL}`)
  log(`  Skill     ${SKILL_NAME}  type=API  → 依赖上面这个 Tool`)
  log('  🔴 API Key 只进 credentials 密文列，binding_config 里不含任何凭证')

  if (!APPLY) { log('\nDRY-RUN 结束。加 --apply 执行。'); return }

  let credId = CRED_ID_ARG
  if (credId) {
    const { data: found } = await admin.from('credentials')
      .select('id,name').eq('id', credId).eq('org_id', org.id).maybeSingle()
    if (!found) bail(`--credential-id 指定的凭证不存在或不属于该租户：${credId}`)
    log(`复用已有凭证：${found.name}（${credId}）`)
  } else {
    const { data: cred, error: credErr } = await admin.from('credentials').insert({
      org_id: org.id, name: 'Google AI API Key', kind: 'api_key',
      secret_ciphertext: encryptVerified(API_KEY), enabled: true,
    }).select('id').single()
    if (credErr) bail(`建凭证失败：${credErr.message}`)
    credId = cred.id
  }

  const { data: plugin, error: pErr } = await admin.from('plugins').insert({
    org_id: org.id, name: PLUGIN_NAME, provider_type: 'api',
    description: '基于 Google Search grounding 的联网检索，返回正文并附真实来源链接。',
    status: 'draft', origin: 'user',
  }).select('id').single()
  if (pErr) bail(`建 Plugin 失败：${pErr.message}`)

  await admin.from('plugin_versions').insert({
    org_id: org.id, plugin_id: plugin.id, version: '1.0.0',
    base_url: 'https://generativelanguage.googleapis.com', status: 'draft',
    changelog: '由 scripts/provision-websearch-plugin.mjs 开通',
  })

  const { data: tool, error: tErr } = await admin.from('tools').insert({
    org_id: org.id, plugin_id: plugin.id, name: 'web_search',
    display_name: '联网搜索', binding_type: 'native', risk_level: 'low', status: 'draft',
  }).select('id').single()
  if (tErr) bail(`建 Tool 失败：${tErr.message}`)

  const { error: tvErr } = await admin.from('tool_versions').insert({
    org_id: org.id, tool_id: tool.id, version: '1.0.0', credential_id: credId,
    binding_config: { handler_id: 'websearch.google', model: SEARCH_MODEL },
    // 只留一个 query：单参数时 tool-node 会直接把节点输入喂进来，不必再问一次模型
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: '检索词，可含时间范围与站点限定' } },
      required: ['query'],
    },
    status: 'draft',
    changelog: '由 scripts/provision-websearch-plugin.mjs 开通',
  })
  if (tvErr) bail(`建 Tool 版本失败：${tvErr.message}`)

  // skills.publisher_id 是 NOT NULL，取本租户任一用户挂上（脚本开通的能力归属租户管理员）
  const { data: publisher } = await admin.from('users')
    .select('id').eq('org_id', org.id).is('deleted_at', null).order('created_at').limit(1).maybeSingle()
  if (!publisher) bail(`租户 ${ORG_CODE} 下没有用户，无法确定 Skill 的发布者`)

  // Skill：workflow tool 节点引用的对象。描述要写清「能做什么」——
  // Copilot 是按这段描述决定该不该把这一步编排到它身上的
  const { data: skill, error: sErr } = await admin.from('skills').insert({
    org_id: org.id, publisher_id: publisher.id, name: SKILL_NAME, type: 'API',
    description: '联网检索最新资讯与网页内容，返回摘要正文并附来源链接。适用于查询当天/近期新闻、行业动态、实时信息。',
    version: '1.0.0', risk_level: 'low', status: 'draft', origin: 'user',
    tags: ['联网', '搜索', '资讯'],
    config: {},
  }).select('id').single()
  if (sErr) bail(`建 Skill 失败：${sErr.message}`)

  const { error: depErr } = await admin.from('skill_plugin_dependencies').insert({
    org_id: org.id, skill_id: skill.id, object_type: 'tool', object_id: tool.id,
    object_version: '1.0.0', required: true,
  })
  if (depErr) bail(`绑定 Skill→Tool 依赖失败：${depErr.message}`)

  log(`\n✅ 已开通。Plugin=${plugin.id}  Tool=${tool.id}  Skill=${skill.id}`)
  log('   均为草稿态。接下来（都在页面上做，脚本不越过审核）：')
  log('   ① Plugin → Tool 列表点「测试」确认连通（probeOnly，不消耗业务语义）；')
  log('   ② 发布 Tool，再发布 Skill；')
  log('   ③ 之后 Copilot 的可用能力清单里就会出现「联网搜索」，能被编排进工作流的 tool 节点。')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
