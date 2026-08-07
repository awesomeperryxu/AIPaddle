/**
 * L2 测试 · WF-6 cron 校验
 *
 * 定时作业的 cron 写错，表现是**到点静默不触发**——不报错不留痕，
 * 要等「该跑却没跑」才被发现，而那时往往已过了一个周期。故保存前必须拦住。
 */
import { describe, it, expect } from 'vitest'
import { validateCron } from '@/lib/agents/cron-validate'

describe('合法表达式', () => {
  it.each([
    ['0 8 * * *', '每天 8:00'],
    ['0 9 * * 1', '每周一 9:00'],
    ['*/15 * * * *', '每 15 分钟'],
    ['0 */2 * * *', '每 2 小时'],
    ['0 9 1 * *', '每月 1 号'],
    ['0 9,18 * * *', '每天 9 点与 18 点'],
    ['0 9 * * 1-5', '工作日 9:00'],
    ['0 0 * * 7', '周日（7 等价于 0）'],
    ['59 23 31 12 *', '边界值'],
  ])('%s（%s）', (expr) => {
    expect(validateCron(expr)).toBe('')
  })
})

describe('段数错误', () => {
  it.each([
    ['', 'cron 不能为空'],
    ['0 8 * *', '4 段'],
    ['0 8 * * * *', '6 段'],
  ])('「%s」被拒', (expr) => {
    expect(validateCron(expr)).not.toBe('')
  })

  it('段数错误时提示实际段数，便于用户自查', () => {
    expect(validateCron('0 8 * *')).toContain('4 段')
  })
})

describe('范围越界', () => {
  it.each([
    ['60 8 * * *', '分钟 60'],
    ['0 24 * * *', '小时 24'],
    ['0 8 32 * *', '日 32'],
    ['0 8 * 13 *', '月 13'],
    ['0 8 * * 8', '星期 8'],
    ['0 8 0 * *', '日 0（日从 1 开始）'],
  ])('「%s」被拒（%s）', (expr) => {
    expect(validateCron(expr)).not.toBe('')
  })

  it('报错点名是哪个字段，不是笼统的「格式错误」', () => {
    expect(validateCron('0 24 * * *')).toContain('小时')
    expect(validateCron('0 8 * 13 *')).toContain('月')
  })
})

describe('格式错误', () => {
  it.each([
    ['a 8 * * *', '非数字'],
    ['0 8 * * mon', '英文星期不支持'],
    ['*/0 * * * *', '步长为 0'],
    ['*/-1 * * * *', '步长为负'],
    ['0 8 5-3 * *', '区间起点大于终点'],
    ['0 8 * * */2/3', '多重步长'],
  ])('「%s」被拒（%s）', (expr) => {
    expect(validateCron(expr)).not.toBe('')
  })
})

describe('容错', () => {
  it('前后空格不影响判定', () => {
    expect(validateCron('  0 8 * * *  ')).toBe('')
  })
  it('段间多空格不影响判定', () => {
    expect(validateCron('0   8  *  * *')).toBe('')
  })
})
