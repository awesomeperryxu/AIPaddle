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

let client: Client

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
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })

  it('带 deleted_at 的表上不得存在「全表唯一」约束（豁免名单除外）', async () => {
    const { rows } = await client.query(`
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
    it(`${table}：${label} —— 唯一索引应为部分索引`, async () => {
      const { rows } = await client.query(
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

  it('审计表 audit_logs 不可有软删列（只追加、不可篡改）', async () => {
    const { rows } = await client.query(`
      select 1 from pg_attribute
      where attrelid='public.audit_logs'::regclass and attname in ('deleted_at','updated_at') and attnum>0
    `)
    expect(rows.length, 'audit_logs 出现了 deleted_at/updated_at，违反「审计只追加」约定').toBe(0)
  })
})
