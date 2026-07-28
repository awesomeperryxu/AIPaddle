/**
 * L3 约束契约测试 · 连**真实 Postgres**，锁住「软删语义」这一类契约。
 *
 * 为什么需要这一层（2026-07-27，BUG-83/86/87/88 的共同教训）：
 * 单元测试全部 mock 了 supabase 客户端，mock 的 insert 直接返回 {error:null}，
 * **真实的唯一约束从来没有被踩过一次**。于是「数据层查重带 .is('deleted_at',null)，
 * 而 DB 约束是全表 unique」这种语义打架，测试再多也发现不了，只能等线上撞。
 *
 * 本测试的契约：**凡是带 deleted_at 的表，其唯一约束必须是「只约束在册行」的部分索引**。
 * 新建 migration 时若写了全表 unique，这里会直接红——把问题挡在合并前，而不是等用户撞。
 *
 * 无 DATABASE_URL（本地未配 / CI 未给 secret）时整组跳过，不误红。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = process.env.DATABASE_URL
const d = DB_URL ? describe : describe.skip

let client: Client | null = null
let connectError: string | null = null

/** 连不上库时干净跳过而非把整个套件染红——本地代理劫持/无 secret 都属环境问题，
 *  不该阻塞与之无关的改动；真连不上时原因会打在跳过说明里，不会被静默吞掉。 */
function requireDb(t: { skip: (note?: string) => void }): boolean {
  if (client) return true
  t.skip(`跳过：无法连接 Postgres（${connectError ?? '未知原因'}）`)
  return false
}

// 软删语义豁免名单：确实应当「全表唯一、软删也占用」的约束写在这里，并写明理由。
// 空名单 = 所有带 deleted_at 的表都必须用部分唯一索引。
const EXEMPT: { constraint: string; reason: string }[] = [
  {
    constraint: 'users_email_key',
    reason:
      'users.id 是主键且引用 auth.users(id)，invite 对已注册邮箱会复用同一 auth uid，' +
      '放开 email 仍会撞 users_pkey。改走「复活软删行」的数据层方案（BUG-86），故保留全表唯一。',
  },
]

d('软删语义契约（连真实 Postgres）', () => {
  beforeAll(async () => {
    try {
      const c = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 8000 })
      await c.connect()
      client = c
    } catch (e) {
      connectError = e instanceof Error ? e.message : String(e)
      client = null
    }
  })
  afterAll(async () => { await client?.end() })

  it('带 deleted_at 的表上不得存在「全表唯一」约束（豁免名单除外）', async (t) => {
    if (!requireDb(t)) return
    const { rows } = await client!.query(`
      select c.conrelid::regclass::text as tbl, c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
      where c.contype = 'u'
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = c.conrelid and a.attname = 'deleted_at' and a.attnum > 0
        )
      order by 1, 2
    `)

    const exemptNames = new Set(EXEMPT.map((e) => e.constraint))
    const offenders = rows.filter((r) => !exemptNames.has(r.conname))

    expect(
      offenders,
      offenders.length
        ? `以下唯一约束是全表生效、不认软删，会导致「删除后无法用同一标识重建」：\n` +
          offenders.map((r) => `  · ${r.tbl}.${r.conname} = ${r.def}`).join('\n') +
          `\n修法：改成 create unique index ... where deleted_at is null；` +
          `确有理由保留全表唯一的，加进本文件的 EXEMPT 名单并写明理由。`
        : '',
    ).toEqual([])
  })

  // 逐表验证「删除后能否用同一 key 重建」——全部在事务内试插并回滚，不留数据。
  const LIFECYCLE: { table: string; label: string }[] = [
    { table: 'user_roles', label: '撤销角色后重新授予同一角色' },
    { table: 'mcp_servers', label: '删除 MCP Server 后同名重建' },
    { table: 'skill_installs', label: '卸载 Skill 后重装' },
    { table: 'agent_resources', label: '移除 Agent 资源后重新绑定' },
    { table: 'tenants', label: '注销租户后复用企业编码' },
  ]

  for (const { table, label } of LIFECYCLE) {
    it(`${table}：${label} —— 唯一索引应为部分索引`, async (t) => {
      if (!requireDb(t)) return
      const { rows } = await client!.query(
        `select indexname, indexdef from pg_indexes
         where schemaname='public' and tablename=$1 and indexdef ilike '%unique%'`,
        [table],
      )
      const uniques = rows.filter((r) => !/_pkey$/.test(r.indexname))
      expect(uniques.length, `${table} 上没有任何唯一索引，用例假设已失效，请更新本测试`).toBeGreaterThan(0)

      const fullTable = uniques.filter((r) => !/where .*deleted_at is null/i.test(r.indexdef))
      expect(
        fullTable.map((r) => `${r.indexname}: ${r.indexdef}`),
        `${table} 存在不认软删的唯一索引，「${label}」会撞唯一约束`,
      ).toEqual([])
    })
  }

  /**
   * 2026-07-27 血的教训：把全表 unique 改成部分唯一索引后，所有
   * `upsert(..., { onConflict: 'a,b' })` 会立刻失效——PostgREST 的 onConflict 只能给列名、
   * 无法表达 WHERE 谓词，Postgres 报 "no unique or exclusion constraint matching the
   * ON CONFLICT specification"。当时 CI 的 seed 步骤和线上「安装 Skill」双双被打挂。
   * 这条用例把「代码里的 onConflict 列组合」与「库里真实存在的**无条件**唯一索引」对账。
   */
  it('代码里每处 onConflict 都必须有对应的「无条件」唯一索引兜底', async (t) => {
    if (!requireDb(t)) return
    // 维护约定：新增 upsert(onConflict) 时同步登记到这里，键=表名，值=onConflict 列组合
    const USAGES: { file: string; table: string; cols: string }[] = [
      { file: 'lib/data/workflow.ts', table: 'workflow_versions', cols: 'workflow_id,version' },
    ]

    const broken: string[] = []
    for (const u of USAGES) {
      const { rows } = await client!.query(
        `select indexdef from pg_indexes
         where schemaname='public' and tablename=$1 and indexdef ilike '%unique%'`,
        [u.table],
      )
      const cols = u.cols.split(',').map((c) => c.trim())
      const ok = rows.some((r) => {
        const def: string = r.indexdef
        if (/where /i.test(def)) return false // 部分索引 → onConflict 匹配不上
        return cols.every((c) => new RegExp(`\\b${c}\\b`).test(def))
      })
      if (!ok) broken.push(`${u.file} → ${u.table}(${u.cols})`)
    }

    expect(
      broken,
      broken.length
        ? `以下 upsert 的 onConflict 找不到「无条件」唯一索引，运行时会报 ` +
          `"no unique or exclusion constraint matching the ON CONFLICT specification"：\n` +
          broken.map((b) => `  · ${b}`).join('\n') +
          `\n修法：把该处 upsert 改成显式「先查后写」（参考 lib/data/skills.ts installSkill）。`
        : '',
    ).toEqual([])
  })

  it('审计表 audit_logs 不可有软删列（只追加、不可篡改）', async (t) => {
    if (!requireDb(t)) return
    const { rows } = await client!.query(`
      select 1 from pg_attribute
      where attrelid='public.audit_logs'::regclass and attname in ('deleted_at','updated_at') and attnum>0
    `)
    expect(rows.length, 'audit_logs 出现了 deleted_at/updated_at，违反「审计只追加」约定').toBe(0)
  })
})
