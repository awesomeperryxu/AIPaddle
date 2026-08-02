/**
 * L1 单测 · Plugin / Tool / Credential 的校验闸门（V12-2.4~2.6）
 *
 * 只测纯函数——它们承载的是**禁止规则**，而禁止规则一旦松一次，
 * 代价是整条依赖链（Skill → Tool → Workflow）的边界失守。
 * CRUD 的数据操作在 L3 集成层验。
 */
import { describe, it, expect } from 'vitest'
import {
  assertPluginName, assertProviderType, PluginValidationError,
  PROVIDER_TYPES, PLUGIN_NAME_MAX,
} from '@/lib/data/plugins'
import { assertBindingType, assertRiskLevel, BINDING_TYPES } from '@/lib/data/tools'
import { assertKind, assertMeta, CREDENTIAL_KINDS } from '@/lib/data/credentials'
import {
  PLUGIN_TRANSITIONS, TOOL_TRANSITIONS, pluginActionsFor, isUsable,
  type PluginStatus, type PluginTransitionAction,
} from '@/lib/plugins/status'

describe('Plugin 名称与 Provider 类型', () => {
  it('正常名称去除首尾空白', () => {
    expect(assertPluginName('  GitHub MCP  ')).toBe('GitHub MCP')
  })

  it('空名 / 纯空白被拒', () => {
    expect(() => assertPluginName('')).toThrow(/不能为空/)
    expect(() => assertPluginName('   ')).toThrow(/不能为空/)
  })

  it('恰好等于上限通过，超一个字被拒（边界不误杀也不放过）', () => {
    expect(assertPluginName('A'.repeat(PLUGIN_NAME_MAX))).toHaveLength(PLUGIN_NAME_MAX)
    expect(() => assertPluginName('A'.repeat(PLUGIN_NAME_MAX + 1))).toThrow(/名称过长/)
  })

  it('三类 Provider 通过', () => {
    for (const t of PROVIDER_TYPES) expect(assertProviderType(t)).toBe(t)
  })

  it('🔴 provider_type 不接受 workflow（D-06）', () => {
    expect(() => assertProviderType('workflow')).toThrow(PluginValidationError)
  })

  it('未知类型与非字符串被拒', () => {
    for (const v of ['http', 'grpc', '', null, undefined, 123, {}]) {
      expect(() => assertProviderType(v), `应拒绝 ${JSON.stringify(v)}`).toThrow()
    }
  })
})

describe('Tool Binding 类型（D-06 / AC-05 的服务端防线）', () => {
  it('五类 Binding 通过', () => {
    for (const t of BINDING_TYPES) expect(assertBindingType(t)).toBe(t)
  })

  it('🔴 workflow 被拒，且错误信息说明为什么', () => {
    expect(() => assertBindingType('workflow')).toThrow(PluginValidationError)
    expect(() => assertBindingType('workflow')).toThrow(/D-06/)
    // 说清后果而不只是"不允许"——否则下一个人会以为是随意的限制而想办法绕过
    expect(() => assertBindingType('workflow')).toThrow(/绕过 D-05/)
  })

  it('🔴 大小写变体也被拒（Workflow / WORKFLOW）', () => {
    for (const v of ['Workflow', 'WORKFLOW', 'WorkFlow']) {
      expect(() => assertBindingType(v), `应拒绝 ${v}`).toThrow(/D-06/)
    }
  })

  it('风险等级：缺省为 low，非法值被拒', () => {
    expect(assertRiskLevel(undefined)).toBe('low')
    expect(assertRiskLevel(null)).toBe('low')
    expect(assertRiskLevel('high')).toBe('high')
    expect(() => assertRiskLevel('critical')).toThrow()
  })
})

describe('Credential 校验', () => {
  it('五类凭证通过', () => {
    for (const k of CREDENTIAL_KINDS) expect(assertKind(k)).toBe(k)
  })

  it('未知类型被拒', () => {
    expect(() => assertKind('plaintext')).toThrow()
    expect(() => assertKind('')).toThrow()
  })

  it('meta 允许非敏感字段', () => {
    expect(assertMeta({ host: 'smtp.example.com', port: 465, user: 'noreply' }))
      .toEqual({ host: 'smtp.example.com', port: 465, user: 'noreply' })
    expect(assertMeta(undefined)).toEqual({})
  })

  it('🔴 meta 混入敏感键名被拒——放错就是明文落库', () => {
    for (const k of ['password', 'passwd', 'pwd', 'secret', 'token', 'api_key',
                     'apiKey', 'private_key', 'client_secret', 'credential']) {
      expect(() => assertMeta({ [k]: 'x' }), `meta.${k} 应被拒`).toThrow(/敏感字段/)
    }
  })

  it('敏感键名大小写不敏感（Password / TOKEN 同样被拒）', () => {
    expect(() => assertMeta({ Password: 'x' })).toThrow(/敏感字段/)
    expect(() => assertMeta({ TOKEN: 'x' })).toThrow(/敏感字段/)
  })

  it('meta 必须是对象，数组与标量被拒', () => {
    expect(() => assertMeta([])).toThrow(/必须是对象/)
    expect(() => assertMeta('x')).toThrow(/必须是对象/)
  })
})

describe('Plugin / Tool 状态机', () => {
  it('两套流转结构完全同构（只有所需权限不同）', () => {
    for (const a of Object.keys(PLUGIN_TRANSITIONS) as PluginTransitionAction[]) {
      expect(TOOL_TRANSITIONS[a].from).toBe(PLUGIN_TRANSITIONS[a].from)
      expect(TOOL_TRANSITIONS[a].to).toBe(PLUGIN_TRANSITIONS[a].to)
    }
    expect(PLUGIN_TRANSITIONS.approve.action).toBe('plugin:review')
    expect(TOOL_TRANSITIONS.approve.action).toBe('tool:review')
  })

  it('各状态下的可用动作', () => {
    expect(pluginActionsFor('draft')).toEqual(['submit'])
    expect(pluginActionsFor('pending').sort()).toEqual(['approve', 'reject'])
    expect(pluginActionsFor('published')).toEqual(['offline'])
    expect(pluginActionsFor('offline')).toEqual(['online'])
  })

  it('🔴 表外流转一律非法（没有跳过审核的路径）', () => {
    const legal = new Set(
      (Object.keys(PLUGIN_TRANSITIONS) as PluginTransitionAction[])
        .map((a) => `${PLUGIN_TRANSITIONS[a].from}→${PLUGIN_TRANSITIONS[a].to}`),
    )
    expect(legal.has('draft→published')).toBe(false)
    expect(legal.has('published→draft')).toBe(false)
    expect(legal.has('draft→offline')).toBe(false)
  })

  it('🔴 只有 published 可被上层依赖——下线要真正阻断新运行（AC-17）', () => {
    expect(isUsable('published')).toBe(true)
    for (const s of ['draft', 'pending', 'offline'] as PluginStatus[]) {
      expect(isUsable(s), `${s} 不应可用`).toBe(false)
    }
  })

  it('提交审核只需 update 权限，发布相关动作需 review 权限', () => {
    expect(PLUGIN_TRANSITIONS.submit.action).toBe('plugin:update')
    expect(PLUGIN_TRANSITIONS.offline.action).toBe('plugin:review')
  })
})
