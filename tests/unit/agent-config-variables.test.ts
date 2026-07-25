/**
 * Agent 编排页「保存失败」bug 复现 + 修复（2026-07-25 用户反馈）
 * 根因：buildConfig 未过滤空变量名的 variables → AgentConfigSchema(min 1) 拒绝 → PATCH 422 → 每次自动保存红字失败。
 * 修复：保存前 variables.filter(v => v.key.trim())。
 */
import { describe, it, expect } from 'vitest'
import { AgentConfigSchema } from '@/lib/agents/config'

describe('AgentConfig 变量校验（保存失败 bug）', () => {
  it('复现：空变量名 → schema 拒绝（这就是保存失败的根因）', () => {
    const r = AgentConfigSchema.partial().safeParse({ variables: [{ key: '', type: 'string' }] })
    expect(r.success).toBe(false)
  })

  it('修复：保存前过滤空 key → 校验通过，仅保留有效变量', () => {
    const variables = [
      { key: '', type: 'string' as const },
      { key: 'city', type: 'string' as const },
    ]
    const filtered = variables.filter((v) => v.key.trim())
    const r = AgentConfigSchema.partial().safeParse({ variables: filtered })
    expect(r.success).toBe(true)
    expect(r.success && r.data.variables?.length).toBe(1)
    expect(r.success && r.data.variables?.[0].key).toBe('city')
  })

  it('全部空 key → 过滤为空数组，仍通过（不阻断保存）', () => {
    const filtered = [{ key: '  ', type: 'string' as const }].filter((v) => v.key.trim())
    expect(filtered).toHaveLength(0)
    expect(AgentConfigSchema.partial().safeParse({ variables: filtered }).success).toBe(true)
  })
})
