/**
 * L1 单测 · Extension 状态机 + Origin 白名单校验（V12-8.4 / ADR-020）
 *
 * 这两块是纯函数，不碰数据库，可独立锁死语义。
 * 重点在**拒绝路径**：Extension 是对外入口，放宽一次的代价是整个租户的数据暴露面。
 */
import { describe, it, expect } from 'vitest'
import {
  EXT_TRANSITIONS, extActionsFor, isCallable,
  type ExtensionStatus, type ExtTransitionAction,
} from '@/lib/extensions/status'
import { assertOrigins, ExtensionValidationError } from '@/lib/data/extensions'

describe('Extension 状态机', () => {
  it('五个动作的起止态与 Agent 状态机同构', () => {
    expect(EXT_TRANSITIONS.submit).toMatchObject({ from: 'draft', to: 'pending' })
    expect(EXT_TRANSITIONS.approve).toMatchObject({ from: 'pending', to: 'published' })
    expect(EXT_TRANSITIONS.reject).toMatchObject({ from: 'pending', to: 'draft' })
    expect(EXT_TRANSITIONS.offline).toMatchObject({ from: 'published', to: 'offline' })
    expect(EXT_TRANSITIONS.online).toMatchObject({ from: 'offline', to: 'published' })
  })

  it('extActionsFor 只返回当前态可用的动作', () => {
    expect(extActionsFor('draft')).toEqual(['submit'])
    expect(extActionsFor('pending').sort()).toEqual(['approve', 'reject'])
    expect(extActionsFor('published')).toEqual(['offline'])
    expect(extActionsFor('offline')).toEqual(['online'])
  })

  it('🔴 只有 published 可被外部调用——下线必须真正断流', () => {
    expect(isCallable('published')).toBe(true)
    for (const s of ['draft', 'pending', 'offline'] as ExtensionStatus[]) {
      expect(isCallable(s), `${s} 不应可调用`).toBe(false)
    }
  })

  it('🔴 表外的流转一律非法（没有 draft→published 这种跳过审核的路径）', () => {
    const legal = new Set(
      (Object.keys(EXT_TRANSITIONS) as ExtTransitionAction[])
        .map((a) => `${EXT_TRANSITIONS[a].from}→${EXT_TRANSITIONS[a].to}`),
    )
    expect(legal.has('draft→published')).toBe(false)   // 跳过审核
    expect(legal.has('published→draft')).toBe(false)   // 需先下线
    expect(legal.has('draft→offline')).toBe(false)     // 未发布不可下线
  })

  it('发布相关动作要求 ext:publish 权限（不是 ext:update）', () => {
    expect(EXT_TRANSITIONS.approve.action).toBe('ext:publish')
    expect(EXT_TRANSITIONS.offline.action).toBe('ext:publish')
    expect(EXT_TRANSITIONS.submit.action).toBe('ext:update')
  })
})

describe('assertOrigins（来源白名单）', () => {
  it('正常来源保留 origin 形式并去重', () => {
    expect(assertOrigins(['https://a.com', 'https://a.com', 'https://b.com:8443']))
      .toEqual(['https://a.com', 'https://b.com:8443'])
  })

  it('空数组合法——含义是「拒绝所有跨域来源」', () => {
    expect(assertOrigins([])).toEqual([])
  })

  it('🔴 拒绝通配符 *（等于对全网开放）', () => {
    expect(() => assertOrigins(['*'])).toThrow(ExtensionValidationError)
    expect(() => assertOrigins(['*'])).toThrow(/全网开放/)
  })

  it('🔴 拒绝带路径的来源——Origin 头本身不含路径，写了永远匹配不上', () => {
    expect(() => assertOrigins(['https://a.com/chat'])).toThrow(/不应含路径/)
    expect(() => assertOrigins(['https://a.com/?x=1'])).toThrow(/不应含路径/)
  })

  it('拒绝非法格式与空值', () => {
    expect(() => assertOrigins(['not-a-url'])).toThrow(/格式无效/)
    expect(() => assertOrigins([''])).toThrow(/不能为空/)
    expect(() => assertOrigins('https://a.com')).toThrow(/必须是数组/)
  })

  it('端口与协议参与比对（https 与 http 不等价）', () => {
    expect(assertOrigins(['http://a.com', 'https://a.com'])).toHaveLength(2)
    expect(assertOrigins(['https://a.com:443'])).toEqual(['https://a.com']) // 默认端口被规范化
  })
})
