import { describe, it, expect } from 'vitest'
import { provisionTenant } from '@/lib/data/tenants'

// ADR-010：开通租户校验（这些校验在触库前抛出，故无需 mock supabase）。
const base = {
  name: '新奇点智能有限公司', code: 'XQD-AI', contactName: '周新',
  contactEmail: 'zhou.xin@aipaddle-test.local', planType: 'standard' as const, tokenQuota: 1_000_000,
}

describe('provisionTenant 校验（S5-04）', () => {
  it('空企业名称被拒', async () => {
    await expect(provisionTenant({ ...base, name: '  ' })).rejects.toThrow(/名称不能为空/)
  })
  it('非法编码被拒', async () => {
    await expect(provisionTenant({ ...base, code: 'a' })).rejects.toThrow(/编码非法/)
  })
  it('非法邮箱被拒', async () => {
    await expect(provisionTenant({ ...base, contactEmail: 'not-email' })).rejects.toThrow(/邮箱格式/)
  })
  it('非正 Token 配额被拒', async () => {
    await expect(provisionTenant({ ...base, tokenQuota: -1 })).rejects.toThrow(/配额必须为正数/)
  })
})
