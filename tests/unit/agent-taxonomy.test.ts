/**
 * 4.1.17 / ADR-013：Agent 四类来源分类派生（与 Skill 同构）
 */
import { describe, it, expect } from 'vitest'
import { deriveAgentCategory, requiresEnterprisePermission } from '@/lib/agents/taxonomy'

describe('deriveAgentCategory（ADR-013 四类）', () => {
  it('platform + mandatory → 平台内置·强制', () => {
    expect(deriveAgentCategory('platform', true, 'published')).toBe('platform-builtin')
  })
  it('platform + 非强制 → 平台市场', () => {
    expect(deriveAgentCategory('platform', false, 'published')).toBe('platform-market')
  })
  it('user + draft → 用户自用', () => {
    expect(deriveAgentCategory('user', false, 'draft')).toBe('user-private')
  })
  it('user + pending/published/offline → 用户推送', () => {
    expect(deriveAgentCategory('user', false, 'pending')).toBe('user-shared')
    expect(deriveAgentCategory('user', false, 'published')).toBe('user-shared')
    expect(deriveAgentCategory('user', false, 'offline')).toBe('user-shared')
  })
})

describe('requiresEnterprisePermission（防越权设强制/平台来源）', () => {
  it('设 mandatory 或 platform 来源 → 需企业级权限', () => {
    expect(requiresEnterprisePermission({ mandatory: true })).toBe(true)
    expect(requiresEnterprisePermission({ origin: 'platform' })).toBe(true)
  })
  it('普通用户草稿 → 不需要', () => {
    expect(requiresEnterprisePermission({ origin: 'user', mandatory: false })).toBe(false)
  })
})
