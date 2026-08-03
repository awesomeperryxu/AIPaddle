/**
 * L2 · binding_config 内联凭证拦截（回归测试）
 *
 * 🔴 这条是真机验证抓出来的：原实现先归一化再查敏感键，而归一化只保留已知键，
 * 误传的 password 被静默丢掉，查的时候什么也查不到 —— 接口回 201，
 * 用户以为凭证配上了，实际凭空消失。静默丢弃比报错更糟：没人会去排查一个"成功"的请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()
const from = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ from })) }))

import { createToolVersion } from '@/lib/data/tool-versions'
import type { RequestContext } from '@/lib/context'

const ctx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Developer'] }
const TOOL_ID = '11111111-1111-4111-8111-111111111111'

/** tools 查询回一个 db 型 Tool；tool_versions.insert 记录实际落库内容 */
function wire(bindingType = 'db') {
  from.mockImplementation((table: string) => {
    if (table === 'tools') {
      return { select: () => ({ eq: () => ({ eq: () => ({ is: () => ({
        maybeSingle: async () => ({ data: { id: TOOL_ID, binding_type: bindingType } }),
      }) }) }) }) }
    }
    return {
      insert: (row: Record<string, unknown>) => {
        insert(row)
        return { select: () => ({ single: async () => ({
          data: { id: 'v1', tool_id: TOOL_ID, version: '1.0.0', input_schema: {}, output_schema: {},
            binding_config: row.binding_config, credential_id: null, changelog: null,
            status: 'draft', created_at: '' },
        }) }) }
      },
    }
  })
}

beforeEach(() => { vi.clearAllMocks(); wire() })

const base = { toolId: TOOL_ID, version: '1.0.0' }
const okDb = { query_template: 'select id from orders', allowed_tables: ['orders'] }

describe('binding_config 内联凭证', () => {
  it('🔴 传 password 时报错，而不是静默丢弃后回 201', async () => {
    await expect(createToolVersion(ctx, {
      ...base, bindingConfig: { ...okDb, password: 'hunter2' },
    })).rejects.toThrow(/凭证/)
    expect(insert).not.toHaveBeenCalled()
  })

  it('各类敏感键名都拦', async () => {
    for (const key of ['api_key', 'apiKey', 'secret', 'access_token', 'private_key', 'passwd']) {
      await expect(createToolVersion(ctx, {
        ...base, bindingConfig: { ...okDb, [key]: 'x' },
      })).rejects.toThrow(/凭证/)
    }
  })

  it('嵌套对象里的凭证也拦', async () => {
    await expect(createToolVersion(ctx, {
      ...base, bindingConfig: { ...okDb, auth: { password: 'x' } },
    })).rejects.toThrow(/凭证/)
  })

  it('🔴 归一化会丢弃的类型（api）同样先查原始输入', async () => {
    // api 的归一化也只保留已知键 —— 与 db 同一个坑
    wire('api')
    await expect(createToolVersion(ctx, {
      ...base,
      bindingConfig: {
        endpoint: 'https://api.example.com/x', method: 'GET',
        allowed_hosts: ['api.example.com'], api_key: 'sk-xxx',
      },
    })).rejects.toThrow(/凭证/)
    expect(insert).not.toHaveBeenCalled()
  })

  it('原样透传的类型（mcp）也拦——这类不归一化，不拦就真存进去了', async () => {
    wire('mcp')
    await expect(createToolVersion(ctx, {
      ...base, bindingConfig: { mcp_tool_name: 'x', token: 'ghp_xxx' },
    })).rejects.toThrow(/凭证/)
  })

  it('credential_id 是引用凭证的正当写法，不算内联', async () => {
    await createToolVersion(ctx, {
      ...base, bindingConfig: { ...okDb, credential_id: 'abc' },
    })
    expect(insert).toHaveBeenCalled()
  })

  it('合法配置正常落库，且落的是归一化结果', async () => {
    await createToolVersion(ctx, { ...base, bindingConfig: { ...okDb, max_rows: 50 } })
    const row = insert.mock.calls[0][0]
    expect(row.binding_config).toMatchObject({
      query_template: 'select id from orders', allowed_tables: ['orders'],
      max_rows: 50, select_only: true,
    })
  })
})
