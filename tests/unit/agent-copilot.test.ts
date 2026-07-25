/**
 * 单元 · lib/agents/copilot 生成主控纯逻辑（4.1.13/4.1.14）
 *   1. filterAuthorizedIds：越权 id 被过滤 + 生成 deniedNotes；清单内 id 保留；去重/空值忽略
 *   2. coercePatch：Zod 裁剪非法字段（非法值丢弃、未知键剔除、非授权 model 丢弃）
 *   3. sanitizeCopilotResult：整合裁剪 + 越权过滤 + reply 提取
 * 纯函数，不碰 DB/网络。
 */
import { describe, it, expect } from 'vitest'
import {
  filterAuthorizedIds,
  coercePatch,
  sanitizeCopilotResult,
  type ResourceItem,
} from '@/lib/agents/copilot'

const kbs: ResourceItem[] = [
  { id: 'kb-1', name: '报销制度库' },
  { id: 'kb-2', name: 'IT 手册' },
]
const skills: ResourceItem[] = [{ id: 'sk-1', name: '工单查询' }]

describe('filterAuthorizedIds · 越权拦截', () => {
  it('清单内保留、清单外过滤并生成 deniedNotes', () => {
    const r = filterAuthorizedIds(['kb-1', 'kb-outsider'], kbs, '知识库')
    expect(r.allowed).toEqual(['kb-1'])
    expect(r.deniedNotes).toHaveLength(1)
    expect(r.deniedNotes[0]).toContain('kb-outsider')
    expect(r.deniedNotes[0]).toContain('知识库')
  })

  it('去重 + 忽略空值 + 非数组安全返回', () => {
    expect(filterAuthorizedIds(['kb-1', 'kb-1', '', ' '], kbs, '知识库').allowed).toEqual(['kb-1'])
    expect(filterAuthorizedIds('kb-1', kbs, '知识库').allowed).toEqual([])
    expect(filterAuthorizedIds(undefined, kbs, '知识库')).toEqual({ allowed: [], deniedNotes: [] })
  })
})

describe('coercePatch · Zod 裁剪', () => {
  it('保留合法 config 字段、剔除未知键', () => {
    const p = coercePatch({
      systemPrompt: '你是客服',
      agentMode: 'react',
      brainMode: 'llm',
      suggestKbIds: ['kb-1'], // 非 config 键，应被剔除
      reply: 'hi', // 非 config 键
    })
    expect(p.systemPrompt).toBe('你是客服')
    expect(p.agentMode).toBe('react')
    expect(p.brainMode).toBe('llm')
    expect('suggestKbIds' in p).toBe(false)
    expect('reply' in p).toBe(false)
  })

  it('丢弃非法值字段而不整体失败', () => {
    const p = coercePatch({ systemPrompt: '正常', agentMode: 'invalid_mode', temperature: 'hot' })
    expect(p.systemPrompt).toBe('正常')
    expect('agentMode' in p).toBe(false) // 非法枚举被丢弃
  })

  it('非授权 model 被丢弃、授权 model 保留', () => {
    expect('model' in coercePatch({ model: 'gpt-4' })).toBe(false)
    expect(coercePatch({ model: 'qwen-max' }).model).toBe('qwen-max')
  })

  it('非对象入参返回空补丁', () => {
    expect(coercePatch(null)).toEqual({})
    expect(coercePatch('x')).toEqual({})
  })
})

describe('sanitizeCopilotResult · 整合', () => {
  it('裁剪补丁 + 授权过滤 + 汇总 deniedNotes + reply', () => {
    const r = sanitizeCopilotResult(
      {
        systemPrompt: 'IT 客服',
        model: 'qwen-plus',
        suggestKbIds: ['kb-1', 'kb-x'],
        suggestSkillIds: ['sk-1', 'sk-y'],
        reply: '已生成配置',
        evil: 'drop-me',
      },
      kbs,
      skills,
    )
    expect(r.patch.systemPrompt).toBe('IT 客服')
    expect(r.patch.model).toBe('qwen-plus')
    expect(r.suggestKbIds).toEqual(['kb-1'])
    expect(r.suggestSkillIds).toEqual(['sk-1'])
    expect(r.deniedNotes).toHaveLength(2) // kb-x + sk-y 各一条
    expect(r.reply).toBe('已生成配置')
  })

  it('空/异常输入返回安全空结果', () => {
    const r = sanitizeCopilotResult({}, kbs, skills)
    expect(r).toEqual({ patch: {}, suggestKbIds: [], suggestSkillIds: [], deniedNotes: [], reply: '' })
  })
})
