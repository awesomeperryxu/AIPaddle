/**
 * 4.1.15：Agent 提示词运行期变量替换
 */
import { describe, it, expect } from 'vitest'
import { substitutePromptVariables } from '@/lib/agents/prompt'

describe('substitutePromptVariables', () => {
  it('替换已提供的 {{变量}}', () => {
    expect(substitutePromptVariables('你好 {{name}}', { name: '小明' })).toBe('你好 小明')
  })
  it('中文变量名', () => {
    expect(substitutePromptVariables('目标语言：{{目标语言}}', { 目标语言: '英语' })).toBe('目标语言：英语')
  })
  it('未提供的变量保留占位（提示未填）', () => {
    expect(substitutePromptVariables('{{a}}-{{b}}', { a: 'X' })).toBe('X-{{b}}')
  })
  it('容忍 {{ name }} 内空白', () => {
    expect(substitutePromptVariables('{{ name }}', { name: 'Y' })).toBe('Y')
  })
  it('空 prompt / 无占位安全', () => {
    expect(substitutePromptVariables('', { a: '1' })).toBe('')
    expect(substitutePromptVariables('无变量文本', { a: '1' })).toBe('无变量文本')
  })
  it('值为空字符串 → 替换为空', () => {
    expect(substitutePromptVariables('[{{x}}]', { x: '' })).toBe('[]')
  })
})
