/**
 * L2 测试 · WF-13 中文时间短语 → cron（定时兜底）
 *
 * 🔴 实测 qwen-plus 对「每天早上8点运行」连续两次都不输出 schedule 字段，
 * prompt 标红、举例、写成硬性要求都压不住。定时是用户明说的需求，
 * 丢了就是功能缺失，所以必须有一条不依赖模型的确定性路径。
 *
 * 判定尺度：拿不准一律不猜——猜错时间比不设更糟（用户以为设好了，实际在错误的点跑）。
 */
import { describe, it, expect } from 'vitest'
import { parseCronFromText, mentionsSchedule } from '@/lib/workflow/schedule-parse'

describe('每天', () => {
  it.each([
    ['每天早上8点运行', '0 8 * * *'],
    ['每天早上 8 点看前一天的内容', '0 8 * * *'],
    ['每日9点30分执行', '30 9 * * *'],
    ['每天晚上8点', '0 20 * * *'],
    ['每天下午3点半', '30 15 * * *'],
    ['每天八点', '0 8 * * *'],
    ['每天中午12点', '0 12 * * *'],
    ['天天早上七点', '0 7 * * *'],
    ['每天跑一次', '0 9 * * *'], // 没说几点 → 默认 9:00
  ])('%s → %s', (text, cron) => expect(parseCronFromText(text)).toBe(cron))
})

describe('每周 / 每月 / 工作日', () => {
  it.each([
    ['每周一早上9点', '0 9 * * 1'],
    ['每星期五下午6点', '0 18 * * 5'],
    ['每周日10点', '0 10 * * 0'],
    ['每月1日8点', '0 8 1 * *'],
    ['每个月15号', '0 9 15 * *'],
    ['每个工作日早上8点', '0 8 * * 1-5'],
  ])('%s → %s', (text, cron) => expect(parseCronFromText(text)).toBe(cron))
})

describe('高频', () => {
  it.each([
    ['每小时执行一次', '0 * * * *'],
    ['每2小时', '0 */2 * * *'],
    ['每30分钟', '*/30 * * * *'],
    ['每分钟', '* * * * *'],
    ['每隔15分钟跑', '*/15 * * * *'],
  ])('%s → %s', (text, cron) => expect(parseCronFromText(text)).toBe(cron))
})

describe('不猜', () => {
  it.each([
    '统计昨天8点之后的订单',   // 「昨天8点」是数据范围，不是定时
    '把今天的数据汇总一下',
    '定时跑一下',              // 说了定时但没说频率
    '',
  ])('%s → undefined', (text) => expect(parseCronFromText(text)).toBeUndefined())

  it('小时数越界不返回错误 cron', () => {
    expect(parseCronFromText('每天99点')).toBe('0 9 * * *') // 时间解析失败 → 回落默认 9:00，而非产出非法 cron
  })
})

describe('mentionsSchedule', () => {
  it('识别周期性字眼', () => {
    expect(mentionsSchedule('每天早上8点运行')).toBe(true)
    expect(mentionsSchedule('定时汇总')).toBe(true)
    expect(mentionsSchedule('把这批数据清洗一下')).toBe(false)
  })
})
