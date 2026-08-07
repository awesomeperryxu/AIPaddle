/**
 * L1 测试 · 运行时时间上下文与「要不要人填输入」的判定（WF-20）
 *
 * 用户实测反馈两件事，根子是同一个：引擎从不告诉流程「现在是什么时候」。
 *   ① 运行一条「查当天 AI 大事件」的流程，被要求手填一个「今天日期」参数；
 *   ② 填了之后跑出来的报告通篇在讲 2024 年 8 月 5 日——模型按训练语料的日期作答。
 */
import { describe, it, expect } from 'vitest'
import {
  buildRuntimeVars,
  renderRuntimeVars,
  runtimeSystemPrompt,
  graphNeedsInput,
} from '@/lib/workflow/runtime-context'

// 固定时刻：2026-08-07T02:30:00Z = 北京时间 2026-08-07 10:30（星期五）
const AT = new Date('2026-08-07T02:30:00Z')

describe('buildRuntimeVars', () => {
  it('按 Asia/Shanghai 算出今天/昨天/明天', () => {
    const v = buildRuntimeVars('Asia/Shanghai', AT)
    expect(v.today).toBe('2026-08-07')
    expect(v.yesterday).toBe('2026-08-06')
    expect(v.tomorrow).toBe('2026-08-08')
    expect(v.now).toBe('2026-08-07 10:30')
    expect(v.weekday).toBe('星期五')
  })

  it('时区不同，「今天」就不同——UTC 下同一时刻仍是 8/7 凌晨', () => {
    const v = buildRuntimeVars('UTC', AT)
    expect(v.now).toBe('2026-08-07 02:30')
  })

  it('跨零点：北京时间刚过午夜时，昨天必须是前一天', () => {
    // 2026-08-07T16:10:00Z = 北京 2026-08-08 00:10
    const v = buildRuntimeVars('Asia/Shanghai', new Date('2026-08-07T16:10:00Z'))
    expect(v.today).toBe('2026-08-08')
    expect(v.yesterday).toBe('2026-08-07')
  })
})

describe('renderRuntimeVars', () => {
  const v = buildRuntimeVars('Asia/Shanghai', AT)

  it('替换 {{today}} / {{yesterday}}', () => {
    expect(renderRuntimeVars('抓取 {{yesterday}} 到 {{today}} 的资讯', v))
      .toBe('抓取 2026-08-06 到 2026-08-07 的资讯')
  })

  it('容忍占位符里的空格', () => {
    expect(renderRuntimeVars('{{ today }}', v)).toBe('2026-08-07')
  })

  it('不认识的占位符原样保留，不吞掉 {{input}}', () => {
    expect(renderRuntimeVars('{{input}} 与 {{foo}}', v)).toBe('{{input}} 与 {{foo}}')
  })
})

describe('runtimeSystemPrompt', () => {
  it('明确写出今天与昨天，并禁止模型用训练数据里的日期', () => {
    const s = runtimeSystemPrompt(buildRuntimeVars('Asia/Shanghai', AT))
    expect(s).toContain('2026-08-07')
    expect(s).toContain('2026-08-06')
    expect(s).toContain('不要使用你训练数据里的日期')
  })
})

describe('graphNeedsInput', () => {
  const node = (type: string, config: Record<string, unknown> = {}) => ({ id: type, type, data: { config } })

  it('「查当天AI大事件」这类自给自足的流程不需要人填输入', () => {
    expect(graphNeedsInput({
      nodes: [node('start'), node('llm', { prompt: '抓取 {{yesterday}} 的资讯' }), node('end')],
      edges: [],
    })).toBe(false)
  })

  it('start 定义了输入变量 → 需要输入', () => {
    expect(graphNeedsInput({
      nodes: [node('start', { variables: [{ key: 'topic', type: 'string' }] })],
      edges: [],
    })).toBe(true)
  })

  it('start 的 variables 是空数组 → 仍然不需要', () => {
    expect(graphNeedsInput({ nodes: [node('start', { variables: [] })], edges: [] })).toBe(false)
  })

  it('提示词引用了 sys.query → 需要输入', () => {
    expect(graphNeedsInput({
      nodes: [node('llm', { prompt: '回答：{{ sys.query }}' })],
      edges: [],
    })).toBe(true)
  })

  it('空图/脏数据不炸', () => {
    expect(graphNeedsInput(null)).toBe(false)
    expect(graphNeedsInput({})).toBe(false)
    expect(graphNeedsInput({ nodes: [{}] })).toBe(false)
  })
})
