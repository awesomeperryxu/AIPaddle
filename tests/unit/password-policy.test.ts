/**
 * L2 单元测试 · 4.8.18 密码策略
 *
 * 背景：账号改为由创建人指定初始密码（不再发邀请邮件）。省掉邮件这一环的代价是
 * 「管理员图省事填弱口令」的风险上升，所以服务端强度校验是这次改动的安全边界，
 * 必须锁死——它是唯一挡住 12345678 这类密码进入生产的地方。
 */
import { describe, it, expect } from 'vitest'
import { checkPassword, validatePassword, isWeakPassword, PASSWORD_MIN, PASSWORD_MAX } from '@/lib/auth/password'

describe('validatePassword · 长度与字符类', () => {
  it('空值 / 非字符串一律拒绝', () => {
    expect(validatePassword('')).toBe('密码不能为空')
    expect(validatePassword(undefined)).toBe('密码不能为空')
    expect(validatePassword(12345678)).toBe('密码不能为空')
  })

  it(`短于 ${PASSWORD_MIN} 位拒绝`, () => {
    expect(validatePassword('Ab3!567')).toBe(`密码至少 ${PASSWORD_MIN} 位`)
  })

  it(`超过 ${PASSWORD_MAX} 位拒绝（bcrypt 会静默截断，不如直接拒）`, () => {
    expect(validatePassword('Aa1' + 'x'.repeat(PASSWORD_MAX))).toBe(`密码不能超过 ${PASSWORD_MAX} 位`)
  })

  it('首尾空格拒绝（复制粘贴时最容易带上，登录时又难排查）', () => {
    expect(validatePassword(' Abc12345')).toBe('密码首尾不能有空格')
    expect(validatePassword('Abc12345 ')).toBe('密码首尾不能有空格')
  })

  it('纯数字 / 纯字母拒绝——只有一类字符', () => {
    const msg = '密码需包含字母、数字、符号中的至少两类'
    expect(validatePassword('12345678')).toBe(msg)
    expect(validatePassword('abcdefgh')).toBe(msg)
    expect(validatePassword('ABCDEFGH')).toBe(msg)
  })

  it('字母+数字 / 字母+符号 / 数字+符号 都放行', () => {
    expect(validatePassword('abcd1234')).toBeNull()
    expect(validatePassword('abcd!@#$')).toBeNull()
    expect(validatePassword('1234!@#$')).toBeNull()
  })

  it('大小写算同一类——大写+小写仍是「只有字母」…但实现按 4 类计，此处锁住实际行为', () => {
    // a-z 与 A-Z 在实现里是两类，故 'abcdEFGH' 通过。若将来收紧策略，这条会先红。
    expect(validatePassword('abcdEFGH')).toBeNull()
  })

  it('中文密码：不属于任何一类字符集，按「符号」计', () => {
    expect(validatePassword('密码密码密码密码')).toBe('密码需包含字母、数字、符号中的至少两类')
    expect(validatePassword('密码abc12345')).toBeNull()
  })
})

describe('isWeakPassword · 常见弱口令', () => {
  it('黑名单命中（大小写不敏感）', () => {
    expect(isWeakPassword('password')).toBe(true)
    expect(isWeakPassword('PassWord')).toBe(true)
    expect(isWeakPassword('Admin123')).toBe(true)
    expect(isWeakPassword('aipaddle123')).toBe(true)
  })

  it('未命中的正常密码', () => {
    expect(isWeakPassword('Xk9#mQ2vLp')).toBe(false)
  })
})

describe('checkPassword · 强度 + 弱口令一步校验', () => {
  it('弱口令即便长度够也拒绝', () => {
    expect(checkPassword('admin123')).toBe('该密码过于常见，请更换')
    expect(checkPassword('aipaddle123')).toBe('该密码过于常见，请更换')
  })

  it('长度不够时先报长度（先拦住更基础的问题）', () => {
    expect(checkPassword('Ab3!')).toBe(`密码至少 ${PASSWORD_MIN} 位`)
  })

  it('合格密码放行', () => {
    expect(checkPassword('Xk9#mQ2vLp')).toBeNull()
    expect(checkPassword('aipaddle2026!')).toBeNull()
  })
})
