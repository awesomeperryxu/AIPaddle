#!/usr/bin/env node
/**
 * Agent 配置完整度体检（A 方案）。
 *
 * 背景：从 WorkBuddy/Dify 之类外部平台导入的 Agent 只搬得动「文本资产」——
 * 提示词、描述。模型、知识库、Skill、Tool 这些**能力接线**搬不过来
 * （两边工具模型不通用），于是产生大量「看着能用、实际是裸 LLM 聊天」的空壳，
 * 而且往往还是 published 状态，对使用者极具误导性。
 *
 * 🔴 关于「安装」：AIPaddle 的 skill_installs 是**按 user_id** 的个人收藏，
 *    与 Dify「插件必须安装才能运行」不是一回事——Agent 挂载/调用 Skill 都不校验安装态。
 *    所以本脚本判定「能不能干活」看的是**挂载**，不是安装；
 *    但对已挂载却未被创建者安装的 Skill 会单独标注（影响该用户在「我的 Skill」里看不到它）。
 *
 * 用法：
 *   node scripts/audit-agents.mjs                 # 体检报告（只读）
 *   node scripts/audit-agents.mjs --unpublish     # 把空壳 Agent 退回 draft
 *   node scripts/audit-agents.mjs --org <uuid>    # 指定租户，默认全平台
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--unpublish')
const orgArgIdx = process.argv.indexOf('--org')
const ONLY_ORG = orgArgIdx > -1 ? process.argv[orgArgIdx + 1] : null

const envPath = path.resolve(process.cwd(), '.env.local')
const env = {}
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 脚本产生的测试资产，不计入体检
const TEST_NAME = /^(DBG-|持久化验证|状态机验证|测试|test|e2e|E2E|smoke|未命名 Agent|YouTube 频道数据分析-|合同审查员-1[78]\d{11}|客服问答助手-1[78]\d{11}|入参校验-1[78]\d{11}|数据分析师-1[78]\d{11})/

function diagnose(agent, resources, installedSkillIds, skillById) {
  const c = agent.config ?? {}
  const missing = []
  const hints = []

  if (!c.systemPrompt || !String(c.systemPrompt).trim()) {
    missing.push('系统提示词')
    hints.push('去「编排」页填写角色设定，否则模型没有任何行为约束')
  }
  // 模型未设时运行期回落租户默认，能跑但不受控——属于「该显式配置却没配」
  if (!c.model) {
    missing.push('模型')
    hints.push('去「编排」页选择模型；当前会回落租户默认模型，行为不受该 Agent 控制')
  }

  const kb = resources.filter(r => r.resource_type === 'knowledge_base')
  const sk = resources.filter(r => r.resource_type === 'skill')
  const tl = resources.filter(r => r.resource_type === 'tool')
  const mcp = resources.filter(r => r.resource_type === 'mcp_server')
  const sub = resources.filter(r => r.resource_type === 'agent')

  const hasAbility = kb.length + sk.length + tl.length + mcp.length + sub.length > 0
  if (!hasAbility) {
    missing.push('能力资源')
    hints.push('未挂载任何知识库 / Skill / Tool / 子 Agent —— 它现在只是一个裸 LLM 对话，不具备平台增强能力')
  }

  // 已挂载但创建者未「安装」的 Skill：不影响 Agent 运行，但该用户在「我的 Skill」里看不到它
  const notInstalled = sk
    .map(r => r.resource_id)
    .filter(id => !installedSkillIds.has(id))
    .map(id => skillById.get(id)?.name ?? id.slice(0, 8))

  // 挂载了未发布的 Skill —— 这个会真的影响可用性
  const unpublished = sk
    .map(r => skillById.get(r.resource_id))
    .filter(s => s && s.status !== 'published')
    .map(s => `${s.name}(${s.status})`)

  if (unpublished.length) {
    missing.push('依赖未过审')
    hints.push(`挂载的 Skill 尚未发布：${unpublished.join('、')} —— 需先完成上架审核`)
  }

  return {
    missing, hints, notInstalled,
    counts: { kb: kb.length, skill: sk.length, tool: tl.length, mcp: mcp.length, subAgent: sub.length },
    // 空壳判定：无任何能力资源 且 未设模型（两者皆缺才算空壳，避免误伤纯提示词型 Agent）
    isShell: !hasAbility && !c.model,
  }
}

async function main() {
  const q = admin.from('agents').select('id,name,status,config,org_id').is('deleted_at', null)
  const { data: agents, error } = ONLY_ORG ? await q.eq('org_id', ONLY_ORG) : await q
  if (error) throw new Error(error.message)

  const { data: resRows } = await admin.from('agent_resources').select('agent_id,resource_type,resource_id')
  const byAgent = new Map()
  for (const r of resRows ?? []) {
    if (!byAgent.has(r.agent_id)) byAgent.set(r.agent_id, [])
    byAgent.get(r.agent_id).push(r)
  }

  const { data: skills } = await admin.from('skills').select('id,name,status').is('deleted_at', null)
  const skillById = new Map((skills ?? []).map(s => [s.id, s]))
  const { data: installs } = await admin.from('skill_installs').select('skill_id').is('deleted_at', null)
  const installedSkillIds = new Set((installs ?? []).map(i => i.skill_id))

  const { data: orgs } = await admin.from('tenants').select('id,name')
  const orgName = new Map((orgs ?? []).map(t => [t.id, t.name]))

  const real = (agents ?? []).filter(a => a.name && !TEST_NAME.test(a.name))
  const shells = []
  const partial = []
  const healthy = []

  for (const a of real) {
    const d = diagnose(a, byAgent.get(a.id) ?? [], installedSkillIds, skillById)
    const row = { ...a, ...d }
    if (d.isShell) shells.push(row)
    else if (d.missing.length) partial.push(row)
    else healthy.push(row)
  }

  console.log(`\n=== Agent 配置体检${ONLY_ORG ? `（租户 ${orgName.get(ONLY_ORG) ?? ONLY_ORG}）` : '（全平台）'} ===`)
  console.log(`共 ${real.length} 个（已排除脚本测试资产）\n`)
  console.log(`✅ 配置完整   ${healthy.length}`)
  console.log(`⚠️  部分缺失   ${partial.length}`)
  console.log(`🔴 空壳       ${shells.length}   ← 无模型且无任何能力资源`)

  const publishedShells = shells.filter(s => s.status === 'published')
  console.log(`   其中已发布 ${publishedShells.length}   ← 最具误导性：使用者以为可用`)

  if (shells.length) {
    console.log('\n--- 空壳明细（前 20）---')
    for (const s of shells.slice(0, 20)) {
      console.log(`  [${s.status}] ${s.name}  (${orgName.get(s.org_id) ?? '?'})  缺：${s.missing.join('、')}`)
    }
    if (shells.length > 20) console.log(`  … 另有 ${shells.length - 20} 个`)
  }

  if (partial.length) {
    console.log('\n--- 部分缺失明细（前 15）---')
    for (const p of partial.slice(0, 15)) {
      const has = Object.entries(p.counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}×${v}`).join(' ')
      console.log(`  [${p.status}] ${p.name}  已有：${has || '无'}  缺：${p.missing.join('、')}`)
    }
    if (partial.length > 15) console.log(`  … 另有 ${partial.length - 15} 个`)
  }

  const withNotInstalled = [...shells, ...partial, ...healthy].filter(a => a.notInstalled.length)
  if (withNotInstalled.length) {
    console.log('\n--- 已挂载但未被任何人「安装」的 Skill ---')
    console.log('（AIPaddle 的安装是个人收藏，不影响 Agent 运行；仅影响它在「我的 Skill」中的可见性）')
    for (const a of withNotInstalled.slice(0, 10)) {
      console.log(`  ${a.name} → ${a.notInstalled.join('、')}`)
    }
  }

  if (APPLY) {
    if (publishedShells.length === 0) {
      console.log('\n没有需要退回的已发布空壳。')
      return
    }
    console.log(`\n=== 执行：把 ${publishedShells.length} 个已发布空壳退回 draft ===`)
    let ok = 0, fail = 0
    for (const s of publishedShells) {
      const { error: e } = await admin.from('agents')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', s.id)
      if (e) { fail++; console.log(`  ❌ ${s.name}: ${e.message}`) } else ok++
    }
    console.log(`退回成功 ${ok}，失败 ${fail}`)
  } else if (publishedShells.length) {
    console.log(`\n提示：加 --unpublish 可把这 ${publishedShells.length} 个已发布空壳退回 draft。`)
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
