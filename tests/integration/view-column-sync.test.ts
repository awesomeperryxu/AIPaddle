/**
 * 契约测试 · 视图列必须跟基表同步（0040 的防回归）
 *
 * 🔴 这条守卫的由来是一次真实的排查弯路：
 * 0039 给 mcp_servers 加了 credential_id，忘了 my_mcp_servers 视图。
 * 视图定义写的是 `select m.*`——看起来「自动包含所有列」，
 * 但 Postgres 在**创建视图时就把 `*` 展开并固化列清单**，加列不会跟着变。
 *
 * 后果的隐蔽程度是重点：
 *   · 单测全绿（1592 条）、pnpm check 退出码 0、typecheck 干净
 *   · MCP 页面完全正常（它查表不查视图）
 *   · 只有 /skill-hub 挂，报的是 `locator('main') 找不到`
 *     ——一个看不出跟数据库有任何关系的前端报错
 * 真因埋在 CI 的 WebServer 日志里：`column my_mcp_servers.credential_id does not exist`。
 *
 * 所以这里直接查库比对，不依赖任何应用层代码路径。
 */
import { describe, it, expect } from 'vitest'
import { Client } from 'pg'

const DSN = process.env.DATABASE_URL

// 无 DATABASE_URL 的环境（本地默认）跳过，与 tests/integration/ 其余用例一致
const d = DSN ? describe : describe.skip

d('视图列与基表同步', () => {
  /** 视图 → 其应当完整覆盖的基表 */
  const PAIRS: { view: string; table: string }[] = [
    { view: 'my_mcp_servers', table: 'mcp_servers' },
  ]

  it.each(PAIRS)('$view 覆盖 $table 的全部列', async ({ view, table }) => {
    const c = new Client({ connectionString: DSN })
    await c.connect()
    try {
      const cols = async (t: string) =>
        (await c.query(
          `select column_name from information_schema.columns
            where table_schema='public' and table_name=$1`, [t],
        )).rows.map((r) => r.column_name as string)

      const [viewCols, tableCols] = await Promise.all([cols(view), cols(table)])
      const missing = tableCols.filter((x) => !viewCols.includes(x))

      expect(
        missing,
        `视图 ${view} 缺少基表 ${table} 的列：${missing.join(', ')}。\n` +
        `多半是刚给基表 ALTER TABLE ADD COLUMN 却没重跑 create or replace view——\n` +
        `\`select *\` 的视图不会自动跟随基表加列（列清单在建视图时已固化）。`,
      ).toEqual([])
    } finally {
      await c.end()
    }
  })

  // 反向也要查：视图多出基表没有的列，说明视图定义与基表漂移了
  it.each(PAIRS)('$view 不含 $table 之外的孤儿列', async ({ view, table }) => {
    const c = new Client({ connectionString: DSN })
    await c.connect()
    try {
      const cols = async (t: string) =>
        (await c.query(
          `select column_name from information_schema.columns
            where table_schema='public' and table_name=$1`, [t],
        )).rows.map((r) => r.column_name as string)

      const [viewCols, tableCols] = await Promise.all([cols(view), cols(table)])
      expect(viewCols.filter((x) => !tableCols.includes(x))).toEqual([])
    } finally {
      await c.end()
    }
  })
})
