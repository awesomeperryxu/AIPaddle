#!/usr/bin/env node
/**
 * V12-3.7：旧 skills.type 迁移 —— 把内联在 config 里的连接配置抽成 Plugin + Tool，
 * 再让 Skill 以显式依赖引用它们。
 *
 * 🔴 第一原则（ADR-018 §4）：**Skill 只增强，不删除**。
 * 迁移前后 Skill 条数必须相等。曾差点把 25 条 Skill Hub 市场目录当脏数据清掉——
 * 那是真实产品内容。
 *
 *   迁移前： Skill { config: { repo, tools[], command, ... } }   ← 配置内联
 *   迁移后： Skill ──依赖──> Tool ──属于──> Plugin                ← 显式依赖
 *            Skill 记录本身一条不减，只是 config 瘦身
 *
 * 用法：
 *   node scripts/migrate-skill-types.mjs              # 默认 dry-run，只报告不写库
 *   node scripts/migrate-skill-types.mjs --apply      # 真正执行（先自动快照）
 *   node scripts/migrate-skill-types.mjs --verify     # 只做迁移后一致性校验
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const VERIFY_ONLY = process.argv.includes('--verify')

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

const MARK = 'migration-v113-3.7'   // 回填数据的标记，回滚时据此精确删除
const log = (s) => console.log(s)

/** 把 skills.config 归类。分类依据见 V12-1.1 排查结论。 */
function classify(skill) {
  const c = skill.config ?? {}
  if (skill.type === 'Workflow') return 'workflow'          // 保持为 Workflow，不迁（D-06）
  if (skill.type === 'Prompt') return 'prompt'              // 原样保留，无连接配置
  if (Array.isArray(c.tools) && c.repo) return 'catalog'    // B 组：公共 MCP 目录
  if (c.mcp_server_id || Array.isArray(c.allowed_tools)) return 'legacy-mcp'  // A 组：旧模型
  if (skill.type === 'API' || skill.type === 'DB') return 'api-db'
  return 'unknown'
}

/** 从一条 catalog Skill 推导出 Plugin + Tool 清单 */
function deriveFromCatalog(skill) {
  const c = skill.config ?? {}
  return {
    plugin: {
      name: skill.name,
      description: skill.description ?? null,
      provider_type: 'mcp',
      repo: c.repo ?? null,
      license: c.license ?? null,
      docs_url: c.docs_url ?? null,
      stars: typeof c.stars === 'number' ? c.stars : null,
      // 迁移产物直接置 published：源 Skill 本就是已发布的市场目录，
      // 置 draft 会让它们在 Plugin 页凭空消失，用户以为数据丢了
      status: skill.status === 'published' ? 'published' : 'draft',
      origin: skill.origin ?? 'platform',
      mandatory: !!skill.mandatory,
    },
    toolNames: (c.tools ?? []).filter((t) => typeof t === 'string'),
  }
}

function deriveFromLegacyMcp(skill) {
  const c = skill.config ?? {}
  return {
    plugin: {
      name: skill.name,
      description: skill.description ?? null,
      provider_type: 'mcp',
      repo: null, license: null, docs_url: null, stars: null,
      status: skill.status === 'published' ? 'published' : 'draft',
      origin: skill.origin ?? 'user',
      mandatory: !!skill.mandatory,
    },
    toolNames: (c.allowed_tools ?? []).filter((t) => typeof t === 'string'),
  }
}

function deriveFromApiDb(skill) {
  return {
    plugin: {
      name: skill.name,
      description: skill.description ?? null,
      provider_type: skill.type === 'API' ? 'api' : 'db',
      repo: null, license: null, docs_url: null, stars: null,
      status: skill.status === 'published' ? 'published' : 'draft',
      origin: skill.origin ?? 'user',
      mandatory: !!skill.mandatory,
    },
    // API/DB 型旧数据没有结构化的 operation 清单，用 Skill 名生成单个 Tool 占位，
    // 具体 Binding 配置由人工在 Plugin 页补全——不臆造 endpoint/query
    toolNames: [`${skill.name}-default`],
  }
}

async function snapshot() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const { data } = await admin.from('skills').select('*').is('deleted_at', null)
  const file = `/tmp/skills_snapshot_${stamp}.json`
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  log(`📸 快照已存：${file}（${(data ?? []).length} 行）`)
  return file
}

async function verify(before) {
  const q = async (t, extra = '') => {
    const { count } = await admin.from(t).select('id', { count: 'exact', head: true }).is('deleted_at', null)
    return count ?? 0
  }
  const skills = await q('skills')
  const installs = await q('skill_installs')
  const plugins = await q('plugins')
  const tools = await q('tools')
  const deps = await q('skill_plugin_dependencies')

  log('')
  log('═══ 一致性校验 ═══')
  const rows = [
    ['skills 条数', before?.skills, skills, before ? skills === before.skills : null],
    ['skill_installs', before?.installs, installs, before ? installs === before.installs : null],
    ['plugins', before?.plugins ?? 0, plugins, null],
    ['tools', before?.tools ?? 0, tools, null],
    ['skill 依赖', before?.deps ?? 0, deps, null],
  ]
  for (const [name, b, a, ok] of rows) {
    const flag = ok === null ? '　' : ok ? '✅' : '🔴'
    log(`${flag} ${name.padEnd(16)} ${b ?? '-'} → ${a}`)
  }
  if (before && skills !== before.skills) {
    log('')
    log('🔴🔴 Skill 条数发生变化——违反迁移第一原则，必须回滚！')
    return false
  }
  return true
}

async function main() {
  log(VERIFY_ONLY ? '=== V12-3.7 校验 ===' : APPLY ? '=== V12-3.7 迁移（真实执行）===' : '=== V12-3.7 迁移（DRY-RUN，不写库）===')

  const { data: skills } = await admin.from('skills').select('*').is('deleted_at', null).order('created_at')
  const all = skills ?? []

  const { count: instBefore } = await admin.from('skill_installs').select('id', { count: 'exact', head: true }).is('deleted_at', null)
  const before = { skills: all.length, installs: instBefore ?? 0, plugins: 0, tools: 0, deps: 0 }

  if (VERIFY_ONLY) { await verify(null); return }

  // 分类统计
  const groups = {}
  for (const s of all) {
    const g = classify(s)
    ;(groups[g] ??= []).push(s)
  }
  log('')
  log('分类结果：')
  for (const [g, list] of Object.entries(groups)) {
    log(`  ${g.padEnd(12)} ${String(list.length).padStart(3)} 条`)
  }

  const migratable = [...(groups.catalog ?? []), ...(groups['legacy-mcp'] ?? []), ...(groups['api-db'] ?? [])]
  log('')
  log(`将迁移 ${migratable.length} 条（catalog + legacy-mcp + api-db）`)
  log(`保持原样 ${(groups.prompt ?? []).length + (groups.workflow ?? []).length} 条（Prompt 原样保留；Workflow 不迁为 Skill 依赖，D-06）`)
  if (groups.unknown?.length) {
    log(`⚠️ 无法分类 ${groups.unknown.length} 条，将跳过并逐条列出：`)
    for (const s of groups.unknown) log(`     · ${s.name}（type=${s.type}）`)
  }

  if (!APPLY) {
    log('')
    log('DRY-RUN 结束。加 --apply 真正执行（会先自动快照）。')
    return
  }

  await snapshot()

  // 取一个创建者（org 内首个非服务账号）
  const creatorByOrg = new Map()
  async function creatorFor(orgId) {
    if (creatorByOrg.has(orgId)) return creatorByOrg.get(orgId)
    const { data } = await admin.from('users').select('id').eq('org_id', orgId)
      .eq('is_service_account', false).is('deleted_at', null).order('created_at').limit(1).maybeSingle()
    creatorByOrg.set(orgId, data?.id ?? null)
    return data?.id ?? null
  }

  let nPlugin = 0, nTool = 0, nDep = 0, nFail = 0
  for (const s of migratable) {
    const kind = classify(s)
    const derived = kind === 'catalog' ? deriveFromCatalog(s)
      : kind === 'legacy-mcp' ? deriveFromLegacyMcp(s)
      : deriveFromApiDb(s)
    const createdBy = await creatorFor(s.org_id)

    // Plugin —— 幂等：同 org 同名已存在则复用
    let { data: plugin } = await admin.from('plugins').select('id')
      .eq('org_id', s.org_id).eq('name', derived.plugin.name).is('deleted_at', null).maybeSingle()
    if (!plugin) {
      const { data, error } = await admin.from('plugins')
        .insert({ ...derived.plugin, org_id: s.org_id, created_by: createdBy })
        .select('id').single()
      if (error) { log(`❌ Plugin「${s.name}」：${error.message}`); nFail++; continue }
      plugin = data; nPlugin++
    }

    // Tools
    for (const tn of derived.toolNames) {
      let { data: tool } = await admin.from('tools').select('id')
        .eq('plugin_id', plugin.id).eq('name', tn).is('deleted_at', null).maybeSingle()
      if (!tool) {
        const { data, error } = await admin.from('tools').insert({
          org_id: s.org_id, created_by: createdBy, plugin_id: plugin.id,
          name: tn, description: null,
          binding_type: derived.plugin.provider_type,   // mcp / api / db
          risk_level: s.risk_level ?? 'low',
          status: derived.plugin.status,
        }).select('id').single()
        if (error) { log(`❌ Tool「${tn}」：${error.message}`); nFail++; continue }
        tool = data; nTool++
      }
      // Skill → Tool 依赖
      const { data: dep } = await admin.from('skill_plugin_dependencies').select('id')
        .eq('skill_id', s.id).eq('object_type', 'tool').eq('object_id', tool.id)
        .is('deleted_at', null).maybeSingle()
      if (!dep) {
        const { error } = await admin.from('skill_plugin_dependencies').insert({
          org_id: s.org_id, skill_id: s.id, object_type: 'tool', object_id: tool.id,
          object_version: null, required: true, created_by: createdBy,
        })
        if (error) { log(`❌ 依赖「${s.name}→${tn}」：${error.message}`); nFail++; continue }
        nDep++
      }
    }

    // 🔴 只打标记，**不动 config、不动 type**——那是步骤⑤清理期的事。
    // 现在就清会让「双读校验」失去对照物，出问题都无从比对。
    await admin.from('skills').update({ migrated_at: new Date().toISOString() }).eq('id', s.id)
  }

  log('')
  log(`迁移完成：Plugin +${nPlugin}　Tool +${nTool}　依赖 +${nDep}　失败 ${nFail}`)
  const ok = await verify(before)
  if (!ok) process.exit(1)
  log('')
  log('📌 下一步（不在本脚本内）：')
  log('   · 双读观察期：新旧路径并行，比对检索/调用结果')
  log('   · 观察期结束后才清理 skills.config 的冗余键与 type 语义（步骤⑤）')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
