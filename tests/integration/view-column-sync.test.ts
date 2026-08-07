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
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'

const DB_URL = process.env.DATABASE_URL
const d = DB_URL ? describe : describe.skip

let client: Client | null = null
let connectError: string | null = null

/** 视图 → 其应当完整覆盖的基表 */
const PAIRS = [{ view: 'my_mcp_servers', table: 'mcp_servers' }] as const

d('视图列与基表同步', () => {
  beforeAll(async () => {
    try {
      // Supabase 走自签证书链；pg 库不像 psql 那样接受连接串里的 sslmode=require，
      // 需去掉该参数并显式给 ssl 选项（留在串里会覆盖显式配置，报 self-signed certificate）。
      const c = new Client({
        connectionString: DB_URL!.replace(/[?&]sslmode=[^&]*/, ''),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      })
      await c.connect()
      client = c
    } catch (e) {
      // 连不上是环境问题（本地代理劫持 / secret 缺失），不该把无关改动染红；
      // 但原因要留在跳过说明里，不静默吞掉。
      connectError = e instanceof Error ? e.message : String(e)
    }
  })

  afterAll(async () => { await client?.end() })

  async function columnsOf(table: string): Promise<string[]> {
    const r = await client!.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1`, [table],
    )
    return r.rows.map((x) => x.column_name as string)
  }

  it.each(PAIRS)('$view 覆盖 $table 的全部列', async ({ view, table }) => {
    if (!client) { expect(connectError, `跳过：连不上数据库（${connectError}）`).toBeTruthy(); return }

    const [viewCols, tableCols] = await Promise.all([columnsOf(view), columnsOf(table)])
    const missing = tableCols.filter((x) => !viewCols.includes(x))

    expect(
      missing,
      `视图 ${view} 缺少基表 ${table} 的列：${missing.join(', ')}。\n` +
      `多半是刚给基表 ALTER TABLE ADD COLUMN 却没重跑 create or replace view——\n` +
      `\`select *\` 的视图不会自动跟随基表加列（列清单在建视图时已固化）。`,
    ).toEqual([])
  })

  // 反向也要查：视图多出基表没有的列，说明视图定义与基表漂移了
  it.each(PAIRS)('$view 不含 $table 之外的孤儿列', async ({ view, table }) => {
    if (!client) { expect(connectError, `跳过：连不上数据库（${connectError}）`).toBeTruthy(); return }

    const [viewCols, tableCols] = await Promise.all([columnsOf(view), columnsOf(table)])
    expect(viewCols.filter((x) => !tableCols.includes(x))).toEqual([])
  })
})
