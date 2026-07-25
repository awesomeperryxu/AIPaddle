/**
 * 4.1.21 / ADR-015：数字员工群聊「谁该发言」纯函数
 *   覆盖：@定向必选（忽略冷却）、主动命中选中、冷却内跳过、无权/无命中不选、parseMentions。
 */
import { describe, it, expect } from 'vitest'
import { parseMentions, selectSpeakers, COOLDOWN_MS, type SpeakParticipant } from '@/lib/agents/group-speak'

const nova: SpeakParticipant = { agentId: 'a-nova', name: '客服Nova', keywords: ['客服Nova', '退款', '售后'] }
const fin: SpeakParticipant = { agentId: 'a-fin', name: '财务Max', keywords: ['财务Max', '报销', '发票'] }

describe('parseMentions', () => {
  it('提取 @名字/@id，止于标点/空白并去重', () => {
    expect(parseMentions('麻烦 @客服Nova 看下，还有 @a-fin，@客服Nova 再确认')).toEqual(['客服Nova', 'a-fin'])
    expect(parseMentions('没有提及')).toEqual([])
  })
})

describe('selectSpeakers', () => {
  const now = 1_000_000

  it('@定向命中的数字员工必选（reason=mention，且忽略冷却）', () => {
    const r = selectSpeakers({
      message: '@客服Nova 帮忙处理',
      participants: [nova, fin],
      cooldownState: { 'a-nova': now - 1 }, // 刚发过言仍在冷却，但被 @ 必选
      now,
    })
    expect(r).toEqual([{ agentId: 'a-nova', reason: 'mention' }])
  })

  it('主动发言：关键词命中且不在冷却 → 选中（reason=proactive）', () => {
    const r = selectSpeakers({
      message: '这笔退款怎么走',
      participants: [nova, fin],
      cooldownState: {},
      now,
    })
    expect(r).toEqual([{ agentId: 'a-nova', reason: 'proactive' }])
  })

  it('冷却内跳过：命中但上次发言距今 < COOLDOWN_MS → 不选', () => {
    const r = selectSpeakers({
      message: '这笔退款怎么走',
      participants: [nova],
      cooldownState: { 'a-nova': now - (COOLDOWN_MS - 1) },
      now,
    })
    expect(r).toEqual([])
  })

  it('冷却已过：命中且距今 >= COOLDOWN_MS → 主动选中', () => {
    const r = selectSpeakers({
      message: '这笔退款怎么走',
      participants: [nova],
      cooldownState: { 'a-nova': now - COOLDOWN_MS },
      now,
    })
    expect(r).toEqual([{ agentId: 'a-nova', reason: 'proactive' }])
  })

  it('无命中不选：既未被 @、关键词也不交集 → 空', () => {
    const r = selectSpeakers({
      message: '今天天气不错',
      participants: [nova, fin],
      cooldownState: {},
      now,
    })
    expect(r).toEqual([])
  })

  it('@定向 + 主动并存：被 @ 的走 mention，另一命中者走 proactive，不重复', () => {
    const r = selectSpeakers({
      message: '@客服Nova 这张发票和报销',
      participants: [nova, fin],
      cooldownState: {},
      now,
    })
    expect(r).toEqual([
      { agentId: 'a-nova', reason: 'mention' },
      { agentId: 'a-fin', reason: 'proactive' },
    ])
  })
})
