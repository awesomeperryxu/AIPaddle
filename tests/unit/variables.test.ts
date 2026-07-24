/**
 * ADR-012 P1 · 变量池表达式解析与类型转换（纯函数）
 */
import { describe, it, expect } from 'vitest'
import { resolveExpr, coerce, type VarPool } from '@/lib/workflow/variables'

function makePool(over: Partial<VarPool> = {}): VarPool {
  return {
    vars: {},
    outputs: new Map<string, string>(),
    sysQuery: '',
    ...over,
  }
}

describe('resolveExpr', () => {
  it('非表达式 → 字面量字符串原样返回', () => {
    expect(resolveExpr('hello world', makePool())).toBe('hello world')
  })

  it('{{ sys.query }} → pool.sysQuery', () => {
    expect(resolveExpr('{{ sys.query }}', makePool({ sysQuery: '用户问题' }))).toBe('用户问题')
  })

  it('{{var}} 命中 pool.vars → 该值（保留原类型）', () => {
    const pool = makePool({ vars: { count: 42 } })
    expect(resolveExpr('{{ count }}', pool)).toBe(42)
  })

  it('{{nodeId}} 命中 pool.outputs → 节点输出串', () => {
    const pool = makePool({ outputs: new Map([['llm-1', 'AI结果']]) })
    expect(resolveExpr('{{llm-1}}', pool)).toBe('AI结果')
  })

  it('未知引用 → undefined', () => {
    expect(resolveExpr('{{ nope }}', makePool())).toBeUndefined()
  })

  it('vars 优先于 outputs（同名时取 vars）', () => {
    const pool = makePool({ vars: { x: 'from-vars' }, outputs: new Map([['x', 'from-outputs']]) })
    expect(resolveExpr('{{x}}', pool)).toBe('from-vars')
  })
})

describe('coerce', () => {
  it('string：任意值转字符串', () => {
    expect(coerce(123, 'string')).toBe('123')
    expect(coerce(null, 'string')).toBe('')
  })

  it('number：字符串数字转数字，非数字回退原值', () => {
    expect(coerce('7', 'number')).toBe(7)
    expect(coerce('abc', 'number')).toBe('abc')
  })

  it('boolean：字符串 "false"/"0"/"" 为假，其余为真', () => {
    expect(coerce('false', 'boolean')).toBe(false)
    expect(coerce('0', 'boolean')).toBe(false)
    expect(coerce('yes', 'boolean')).toBe(true)
    expect(coerce(1, 'boolean')).toBe(true)
  })

  it('array：JSON 字符串解析为数组，失败回退原值', () => {
    expect(coerce('[1,2,3]', 'array')).toEqual([1, 2, 3])
    expect(coerce('not-json', 'array')).toBe('not-json')
    expect(coerce([9], 'array')).toEqual([9])
  })

  it('array[string] 归并为 array 处理', () => {
    expect(coerce('["a","b"]', 'array[string]')).toEqual(['a', 'b'])
  })

  it('object：JSON 对象字符串解析，数组/非对象回退', () => {
    expect(coerce('{"a":1}', 'object')).toEqual({ a: 1 })
    expect(coerce('[1,2]', 'object')).toBe('[1,2]')
  })
})
