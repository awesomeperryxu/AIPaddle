/**
 * L2 单元测试 · BUG-83 企业编码唯一约束语义对齐
 * 背景：0001 的 `code text not null unique` 是全表唯一（不认软删），而 provisionTenant 查重
 * 带 `.is('deleted_at', null)`——认为软删的不占。两者打架 → 应用层放行、DB 拦下、甩 PG 原文。
 * 迁移 0024 把 DB 改为部分唯一索引（仅约束在册租户）；本测试锁住「冲突必须报人话」的兜底。
 */
import { describe, it, expect } from 'vitest'
import { provisionTenant } from '@/lib/data/tenants'

const base = {
  name: '北京市品器管理咨询有限公司', code: 'PinQi', contactName: '张丁丁',
  contactEmail: 'zhangdd+pinqi@aipaddle-test.local', tokenQuota: 1_000_000,
}

type Opts = { insertError?: { message: string; code?: string } }

// 假 admin client：查重放行（模拟"软删记录被 deleted_at 过滤掉"）、邮箱未占用，插入按需报错
function stubAdmin(o: Opts = {}) {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() { return chain },
        eq() { return chain },
        is() { return chain },
        async maybeSingle() { return { data: null, error: null } }, // code 查重与邮箱查重都放行
        insert() { return chain },
        async single() {
          if (table === 'tenants' && o.insertError) return { data: null, error: o.insertError }
          return { data: null, error: { message: 'unexpected' } }
        },
      }
      return chain
    },
  }
}

describe('provisionTenant 编码冲突报人话（BUG-83）', () => {
  it('撞旧的全表唯一约束 tenants_code_key → 说明可能是已注销租户占着', async () => {
    const admin = stubAdmin({
      insertError: {
        message: 'duplicate key value violates unique constraint "tenants_code_key"',
        code: '23505',
      },
    })
    await expect(provisionTenant(base, admin as never))
      .rejects.toThrow('该企业编码已被占用（可能属于一个已注销的租户，编码仍被旧约束保留），请更换编码')
  })

  it('撞迁移 0024 后的部分唯一索引 → 直说编码已存在', async () => {
    const admin = stubAdmin({
      insertError: {
        message: 'duplicate key value violates unique constraint "uq_tenants_code_active"',
        code: '23505',
      },
    })
    await expect(provisionTenant(base, admin as never))
      .rejects.toThrow('该企业编码已存在，请更换编码')
  })

  it('非唯一约束的其它数据库错误 → 原样透出，不误导', async () => {
    const admin = stubAdmin({ insertError: { message: 'connection terminated', code: '08006' } })
    await expect(provisionTenant(base, admin as never)).rejects.toThrow('connection terminated')
  })
})
