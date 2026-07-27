/**
 * L2 单元测试 · 4.8.15a/b updateTenantByPlatform 校验与落库
 * 重点：配额语义（0=不限制、负数/小数拒绝）、code 不可改、空 patch 不写库、租户已注销 404 语义。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ updated: null as Record<string, unknown> | null, returnRows: [{ id: 't1' }] as unknown[] }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from() {
      const chain: Record<string, unknown> = {
        update(row: Record<string, unknown>) { state.updated = row; return chain },
        eq() { return chain },
        is() { return chain },
        select() { return chain },
        then(res: (v: unknown) => void) { return res({ data: state.returnRows, error: null }) },
      }
      return chain
    },
  })),
}))

import { updateTenantByPlatform } from '@/lib/data/tenants'

beforeEach(() => {
  vi.clearAllMocks()
  state.updated = null
  state.returnRows = [{ id: 't1' }]
})

describe('updateTenantByPlatform（4.8.15a/b）', () => {
  it('空 patch → 不写库', async () => {
    await updateTenantByPlatform('t1', {})
    expect(state.updated).toBeNull()
  })

  it('企业名称为空白 → 拒绝', async () => {
    await expect(updateTenantByPlatform('t1', { name: '   ' })).rejects.toThrow('企业名称不能为空')
  })

  it('企业名称超长（>80）→ 拒绝', async () => {
    await expect(updateTenantByPlatform('t1', { name: '企'.repeat(81) })).rejects.toThrow('不能超过 80 字')
  })

  it('邮箱格式非法 → 拒绝', async () => {
    await expect(updateTenantByPlatform('t1', { contactEmail: 'not-an-email' })).rejects.toThrow('联系邮箱格式非法')
  })

  it('配额为 0 → 允许（与 4.8.2 decideQuota 的「0=不限制」语义一致）', async () => {
    await updateTenantByPlatform('t1', { tokenQuota: 0 })
    expect(state.updated).toMatchObject({ token_quota: 0 })
  })

  it('配额为负数 → 拒绝', async () => {
    await expect(updateTenantByPlatform('t1', { tokenQuota: -1 }))
      .rejects.toThrow('Token 配额必须为非负整数（0 表示不限制）')
  })

  it('配额为小数 → 拒绝', async () => {
    await expect(updateTenantByPlatform('t1', { qpsLimit: 1.5 }))
      .rejects.toThrow('QPS 上限必须为非负整数（0 表示不限制）')
  })

  it('三项配额一起改 → 列名映射正确', async () => {
    await updateTenantByPlatform('t1', { tokenQuota: 100, storageQuota: 200, qpsLimit: 3 })
    expect(state.updated).toMatchObject({ token_quota: 100, storage_quota: 200, qps_limit: 3 })
  })

  it('联系人传 null / 空串 → 落库为 null', async () => {
    await updateTenantByPlatform('t1', { contactName: '  ' })
    expect(state.updated).toMatchObject({ contact_name: null })
  })

  it('name/email 落库前已 trim', async () => {
    await updateTenantByPlatform('t1', { name: '  某企业  ', contactEmail: '  a@b.com  ' })
    expect(state.updated).toMatchObject({ name: '某企业', contact_email: 'a@b.com' })
  })

  it('code 不在可改字段内（对外标识，被 seed/e2e/外部集成引用）', async () => {
    await updateTenantByPlatform('t1', { name: '某企业' } as never)
    expect(Object.keys(state.updated ?? {})).not.toContain('code')
  })

  it('目标租户不存在或已注销（update 命中 0 行）→ 抛 404 语义错误', async () => {
    state.returnRows = []
    await expect(updateTenantByPlatform('gone', { name: 'x' })).rejects.toThrow('租户不存在或已注销')
  })

  it('每次写入都带 updated_at', async () => {
    await updateTenantByPlatform('t1', { name: '某企业' })
    expect(state.updated).toHaveProperty('updated_at')
  })
})
