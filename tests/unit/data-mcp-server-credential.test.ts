/**
 * 单元 · lib/data/mcp-servers 的凭证绑定（0039）
 *
 * 🔴 为什么单独测数据层：api-mcp-server-credential.test.ts mock 掉了整个数据层，
 * 于是「解绑用真值判定被静默吞掉」这类缺陷在那一层测不出来——
 * 实测把 `patch.credentialId !== undefined` 改成 `patch.credentialId`，
 * API 层 14 条测试**全绿**。判定逻辑在哪一层，测试就得钉在哪一层。
 *
 * 解绑被吞的后果很实际：用户点「移除凭证」，界面显示成功、库里绑定还在，
 * 下次连接照旧用着那把已经作废的 Key。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

const { state, updateSpy, insertSpy } = vi.hoisted(() => ({
  state: { row: {} as Record<string, unknown> },
  updateSpy: vi.fn(),
  insertSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => {
  const make = () => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.is = () => b
    b.order = () => Promise.resolve({ data: [state.row], error: null })
    b.update = (fields: unknown) => { updateSpy(fields); return b }
    b.insert = (fields: unknown) => { insertSpy(fields); return b }
    b.maybeSingle = () => Promise.resolve({ data: state.row, error: null })
    b.single = () => Promise.resolve({ data: state.row, error: null })
    return b
  }
  return { createClient: vi.fn(async () => ({ from: () => make() })) }
})

import { createMcpServer, updateMcpServer } from '@/lib/data/mcp-servers'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const ID = '456d60b5-8d64-445a-b9d1-4d9c30e9ae92'
const CRED = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

beforeEach(() => {
  vi.clearAllMocks()
  state.row = {
    id: ID, name: 'Notion', description: null, type: 'third_party',
    endpoint: 'https://mcp.notion.com/mcp', auth_type: 'api_key', credential_id: null,
    scope: null, status: 'draft', security_level: 'medium',
    allowed_roles: ['Admin'], allowed_departments: [], created_at: null, updated_at: null,
  }
})

describe('凭证绑定的写入语义', () => {
  it('绑定凭证 → 写入 credential_id', async () => {
    await updateMcpServer(ctx, ID, { credentialId: CRED })
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ credential_id: CRED }))
  })

  // 🔴 这条是本文件存在的理由：null 是「解绑」的合法意图，不是「没传」
  it('credentialId: null → 必须写入 null 完成解绑', async () => {
    await updateMcpServer(ctx, ID, { credentialId: null })
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ credential_id: null }))
  })

  it('不传 credentialId → 不碰该列', async () => {
    await updateMcpServer(ctx, ID, { name: '改名' })
    const fields = updateSpy.mock.calls[0][0] as Record<string, unknown>
    expect(fields).not.toHaveProperty('credential_id')
    expect(fields).toMatchObject({ name: '改名' })
  })

  it('创建时可直接带凭证引用', async () => {
    await createMcpServer(ctx, { name: 'N', endpoint: 'https://x/mcp', credentialId: CRED })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ credential_id: CRED }))
  })

  it('创建时不带 → credential_id 为 null 而非 undefined', async () => {
    await createMcpServer(ctx, { name: 'N', endpoint: 'https://x/mcp' })
    expect(insertSpy.mock.calls[0][0]).toHaveProperty('credential_id', null)
  })
})

describe('读取时不外泄密文', () => {
  it('查询列里没有 auth_config', async () => {
    // auth_config 是 jsonb 明文列，一旦进 SELECT 就可能顺着响应流到前端
    const src = (await import('node:fs')).readFileSync('lib/data/mcp-servers.ts', 'utf8')
    const cols = src.match(/const COLS =\s*\n?\s*'([^']+)'/)?.[1] ?? ''
    expect(cols).not.toContain('auth_config')
    expect(cols).toContain('credential_id')
  })

  it('映射结果带 credentialId 供前端显示已配/未配', async () => {
    state.row = { ...state.row, credential_id: CRED }
    const r = await updateMcpServer(ctx, ID, { name: 'x' })
    expect(r?.credentialId).toBe(CRED)
  })
})
