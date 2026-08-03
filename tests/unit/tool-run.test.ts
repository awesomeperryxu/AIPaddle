/**
 * GAP-1 · Agent 真实调用 Tool（lib/tools/run.ts）
 *
 * 重点不是「能调通」，是**模型给的参数不能变成攻击面**：
 *   · DB 参数必须走 $1/$2 占位，不能拼进 SQL
 *   · SMTP 收件人只能来自配置，不能由模型指定
 *   · 已下线的 Tool 装载后仍要在调用期被拦
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const pgQuery = vi.fn()
const pgConnect = vi.fn(async () => {})
const pgEnd = vi.fn(async () => {})
vi.mock('pg', () => ({
  Client: class { connect = pgConnect; query = pgQuery; end = pgEnd },
}))
vi.mock('server-only', () => ({}))

const runHandler = vi.fn(async () => ({ ok: true, message: '已投递' }))
vi.mock('@/lib/tools/handlers', () => ({ runHandler: (...a: unknown[]) => runHandler(...(a as [])) }))

const guardedFetch = vi.fn()
vi.mock('@/lib/tools/net-guard', () => ({
  guardedFetch: (...a: unknown[]) => guardedFetch(...(a as [])),
  NetGuardError: class NetGuardError extends Error {},
}))

const getCredentialPlaintext = vi.fn(async () => 'postgres://u:p@h/db')
const getCredentialById = vi.fn(async () => ({ meta: { host: 'smtp.x.com', port: 465, user: 'a@x.com' } }))
vi.mock('@/lib/data/credentials', () => ({
  getCredentialPlaintext: () => getCredentialPlaintext(),
  getCredentialById: () => getCredentialById(),
}))

let versionRow: Record<string, unknown> | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: versionRow }) }) }) }),
      }),
    }),
  }),
}))

import { runToolVersion } from '@/lib/tools/run'
import type { RequestContext } from '@/lib/context'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['User'] }
const VID = '11111111-1111-4111-8111-111111111111'

const dbVersion = (query: string, extra: Record<string, unknown> = {}) => ({
  id: VID, status: 'published', credential_id: 'c1',
  tools: { binding_type: 'db', status: 'published' },
  binding_config: {
    query_template: query, allowed_tables: ['orders'], max_rows: 10,
    mask_fields: [], param_schema: {}, select_only: true, ...extra,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  pgQuery.mockResolvedValue({ rows: [{ id: 1 }], fields: [] })
  runHandler.mockResolvedValue({ ok: true, message: '已投递' })
})

describe('DB 工具调用', () => {
  it('🔴 参数走 $1 占位传入，不拼进 SQL（防注入）', async () => {
    versionRow = dbVersion('select id from orders where customer = :name')
    await runToolVersion(ctx, VID, { name: "x'; drop table orders; --" })

    // 第一条是 set session read only，第二条才是真查询
    const call = pgQuery.mock.calls.find((c) => String(c[0]).includes('_t'))!
    const [sql, values] = call
    expect(sql).toContain('$1')
    expect(sql).not.toContain('drop table')      // 恶意值没有进入 SQL 文本
    expect(values).toEqual(["x'; drop table orders; --"])
  })

  it('多个参数按出现顺序编号', async () => {
    versionRow = dbVersion('select id from orders where a = :x and b = :y and c = :x')
    await runToolVersion(ctx, VID, { x: 1, y: 2 })
    const [sql, values] = pgQuery.mock.calls.find((c) => String(c[0]).includes('_t'))!
    expect(sql).toMatch(/\$1.*\$2.*\$3/)
    expect(values).toEqual([1, 2, 1])
  })

  it('强制只读会话', async () => {
    versionRow = dbVersion('select id from orders')
    await runToolVersion(ctx, VID, {})
    expect(pgQuery.mock.calls[0][0]).toMatch(/read only/i)
  })

  it('行数上限与截断提示', async () => {
    versionRow = dbVersion('select id from orders')
    pgQuery.mockImplementation(async (sql: string) =>
      String(sql).includes('_t')
        ? { rows: Array.from({ length: 11 }, (_, i) => ({ id: i })), fields: [] }
        : { rows: [], fields: [] })
    const r = await runToolVersion(ctx, VID, {})
    expect(r.content).toMatch(/截断/)
    expect(JSON.parse(r.content.split('\n')[0])).toHaveLength(10)
  })

  it('脱敏字段生效', async () => {
    versionRow = dbVersion('select name from orders', { mask_fields: ['name'] })
    pgQuery.mockImplementation(async (sql: string) =>
      String(sql).includes('_t') ? { rows: [{ name: '张三' }], fields: [] } : { rows: [] })
    const r = await runToolVersion(ctx, VID, {})
    expect(r.content).toContain('***')
    expect(r.content).not.toContain('张三')
  })

  it('🔴 调用期重校验 select-only（存量配置可能早于规则）', async () => {
    versionRow = dbVersion('update orders set amount = 0')
    const r = await runToolVersion(ctx, VID, {})
    expect(r.ok).toBe(false)
    expect(r.content).toMatch(/配置不合法|SELECT/)
    expect(pgQuery).not.toHaveBeenCalled()
  })

  it('错误信息里隐去连接串', async () => {
    versionRow = dbVersion('select id from orders')
    pgQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('_t')) throw new Error('failed at postgres://user:secret@host/db')
      return { rows: [] }
    })
    const r = await runToolVersion(ctx, VID, {})
    expect(r.content).not.toContain('secret')
    expect(r.content).toContain('连接串已隐去')
  })
})

describe('SMTP 工具调用', () => {
  const smtpVersion = {
    id: VID, status: 'published', credential_id: 'c1',
    tools: { binding_type: 'smtp', status: 'published' },
    binding_config: {
      from_address: 'a@x.com', from_name: '通知', to: ['boss@x.com'], cc: [], reply_to: '',
      subject_template: '新线索：{{name}}', body_template: '<p>{{detail}}</p>',
    },
  }

  it('🔴 收件人只用配置里的，模型指定的一律忽略', async () => {
    // 让模型决定发给谁 = 一次提示注入就能把内部信息发到站外
    versionRow = smtpVersion
    await runToolVersion(ctx, VID, { to: ['attacker@evil.com'], name: '张三', detail: 'x' })
    const cfg = runHandler.mock.calls[0][0] as unknown as { config: Record<string, unknown> }
    expect(cfg.config.to).toEqual(['boss@x.com'])
    expect(JSON.stringify(cfg.config.to)).not.toContain('evil.com')
  })

  it('主题与正文按参数填充', async () => {
    versionRow = smtpVersion
    await runToolVersion(ctx, VID, { name: '张三', detail: '需要保洁' })
    const cfg = (runHandler.mock.calls[0][0] as unknown as { config: Record<string, unknown> }).config
    expect(cfg.subject_template).toBe('新线索：张三')
    expect(cfg.body_template).toContain('需要保洁')
  })
})

describe('调用期的发布状态检查', () => {
  it('🔴 Tool 已下线时拒绝调用（装载与调用之间可能隔很久）', async () => {
    versionRow = { ...dbVersion('select 1 from orders'), tools: { binding_type: 'db', status: 'offline' } }
    const r = await runToolVersion(ctx, VID, {})
    expect(r.ok).toBe(false)
    expect(r.content).toMatch(/已下线/)
  })

  it('版本本身未发布时拒绝调用', async () => {
    versionRow = { ...dbVersion('select 1 from orders'), status: 'draft' }
    const r = await runToolVersion(ctx, VID, {})
    expect(r.ok).toBe(false)
    expect(r.content).toMatch(/已下线/)
  })

  it('版本不存在时给出可读结论', async () => {
    versionRow = null
    const r = await runToolVersion(ctx, VID, {})
    expect(r.ok).toBe(false)
    expect(r.content).toMatch(/不存在|无权访问/)
  })
})
