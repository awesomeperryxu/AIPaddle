/**
 * L2 测试 · WF-7 创建计划
 *
 * 用户要求：识别到要创建 Agent / workflow / Skill 等对象时，必须先说明
 * **建哪些、先后顺序、最终实现什么**，而不是一句「正在带你去创建页面」。
 *
 * 🔴 用模板而非 LLM 生成：步骤与顺序由意图类型确定，交给模型会漏步骤、
 * 顺序颠倒，甚至把「需人工确认」的步骤写成自动完成——那是安全边界，不能靠发挥。
 */
import { describe, it, expect } from 'vitest'
import { buildCreationPlan, renderPlan } from '@/lib/assistant/plan'
import type { IntentKind } from '@/lib/assistant/intent'

const KINDS: Exclude<IntentKind, 'chat'>[] = [
  'create-agent', 'create-skill', 'create-workflow', 'create-chatflow', 'create-scheduled-workflow',
]

describe('每种创建意图都有计划', () => {
  it.each(KINDS)('%s 有序号连续的步骤与最终目标', (kind) => {
    const p = buildCreationPlan(kind, '每天早上8点汇总AI资讯')
    expect(p.steps.length).toBeGreaterThan(0)
    expect(p.steps.map((s) => s.order)).toEqual(p.steps.map((_, i) => i + 1))
    expect(p.intro).toBeTruthy()
    expect(p.outcome).toBeTruthy()
    for (const s of p.steps) expect(s.title).toBeTruthy()
  })

  it('描述为空时不出现空引号「」', () => {
    const p = buildCreationPlan('create-workflow', '   ')
    expect(p.intro).not.toContain('「」')
  })
})

describe('定时工作流：五步且顺序固定', () => {
  const p = buildCreationPlan('create-scheduled-workflow', '每天8点查AI大事件')

  it('步骤顺序为 建流程→发布→建Agent→发布→配定时', () => {
    expect(p.steps).toHaveLength(5)
    expect(p.steps[0].title).toContain('工作流')
    expect(p.steps[1].title).toContain('发布工作流')
    expect(p.steps[2].title).toContain('Agent')
    expect(p.steps[3].title).toContain('发布 Agent')
    expect(p.steps[4].title).toContain('定时')
  })

  // 🔴 两道人工闸是安全边界，不能被写成自动
  it('两次发布都标记为需人工确认', () => {
    expect(p.steps[1].needsConfirm).toBe(true)
    expect(p.steps[3].needsConfirm).toBe(true)
  })

  it('生成与衔接步骤不需确认（否则用户要点五次）', () => {
    expect(p.steps[0].needsConfirm).toBe(false)
    expect(p.steps[2].needsConfirm).toBe(false)
    expect(p.steps[4].needsConfirm).toBe(false)
  })

  it('发布 Agent 一步说明无审批权限时的走向', () => {
    expect(p.steps[3].detail).toContain('审')
  })
})

describe('Agent 计划要点破空壳风险', () => {
  // 外部导入或纯生成的 Agent 常是「只有提示词没有能力」，用户以为能用
  it('最终实现里说明未挂载能力则只是普通对话', () => {
    const p = buildCreationPlan('create-agent', '做一个客服助手')
    expect(p.outcome).toMatch(/知识库|工具/)
  })
})

describe('渲染为对话文本', () => {
  const text = renderPlan(buildCreationPlan('create-scheduled-workflow', '每天8点查AI大事件'))

  it('包含计划标题、全部步骤与最终实现', () => {
    expect(text).toContain('创建计划')
    expect(text).toContain('最终实现')
    for (let i = 1; i <= 5; i++) expect(text).toContain(`${i}. `)
  })

  it('需确认的步骤在文本里显式标出', () => {
    expect(text).toContain('需你确认')
    // 五步里恰好两处
    expect(text.split('需你确认').length - 1).toBe(2)
  })
})
