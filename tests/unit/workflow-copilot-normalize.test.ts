/**
 * L2 测试 · Copilot 产出图的规范化（WF-4 / WF-5 / WF-6 / WF-2）
 *
 * 用户实测反馈：AI 生成 6 个节点后「都堆叠在一起，拉开以后也毫无逻辑」。
 * 三个独立缺陷叠加：
 *   ① 节点没有 position → 全部落到同一个 DEFAULT_POS，严格重叠；
 *   ② 模型输出的是顶层 label，而 graph-adapter 读 data.label → 画布上只显示
 *      "llm"/"end" 这种类型名，看不出每一步在干什么；
 *   ③ if-else 出边没有 sourceHandle → 既挂不上画布的 IF/ELSE 句柄，
 *      执行引擎也永远匹配不到分支，流程跑到判断处就断。
 * 外加 WF-2：「每天早上 8 点」以前被静默吞掉，现在必须落成 trigger-schedule + cron。
 */
import { describe, it, expect } from 'vitest'
import { normalizeGraph, type RawGraph } from '@/lib/workflow/copilot'

const linear: RawGraph = {
  nodes: [
    { id: 's', type: 'start', label: '开始' },
    { id: 'l', type: 'llm', label: '提炼要点', config: { prompt: '总结：{{input}}' } },
    { id: 'e', type: 'end', label: '输出结果' },
  ],
  edges: [{ source: 's', target: 'l' }, { source: 'l', target: 'e' }],
}

describe('WF-4 节点位置', () => {
  it('每个节点都有 position，且互不重叠', () => {
    const g = normalizeGraph(linear)
    const xs = g.nodes.map((n) => n.position?.x)
    expect(xs.every((x) => typeof x === 'number')).toBe(true)
    expect(new Set(g.nodes.map((n) => `${n.position?.x},${n.position?.y}`)).size).toBe(3)
  })

  it('按流程顺序从左到右排列', () => {
    const g = normalizeGraph(linear)
    const x = Object.fromEntries(g.nodes.map((n) => [n.id, n.position!.x]))
    expect(x.s).toBeLessThan(x.l)
    expect(x.l).toBeLessThan(x.e)
  })
})

describe('WF-5 节点标题', () => {
  it('顶层 label 收进 data.label（否则画布显示的是类型名）', () => {
    const g = normalizeGraph(linear)
    expect(g.nodes.map((n) => n.data?.label)).toEqual(['开始', '提炼要点', '输出结果'])
  })

  it('模型没给 label 时回落到中文类型名，不显示英文 type', () => {
    const g = normalizeGraph({ nodes: [{ id: 'l', type: 'llm' }], edges: [] })
    expect(g.nodes[0].data?.label).toBe('大模型处理')
  })

  it('config 收进 data.config，执行引擎才读得到 prompt', () => {
    const g = normalizeGraph(linear)
    expect(g.nodes[1].data?.config).toEqual({ prompt: '总结：{{input}}' })
  })
})

describe('WF-6 if-else 分支句柄', () => {
  const branchy: RawGraph = {
    nodes: [
      { id: 's', type: 'start', label: '开始' },
      { id: 'c', type: 'if-else', label: '内容是否有效' },
      { id: 'a', type: 'llm', label: '生成简报' },
      { id: 'b', type: 'llm', label: '记录无结果' },
      { id: 'e', type: 'end', label: '结束' },
    ],
    edges: [
      { source: 's', target: 'c' },
      { source: 'c', target: 'a' },
      { source: 'c', target: 'b' },
      { source: 'a', target: 'e' },
      { source: 'b', target: 'e' },
    ],
  }

  it('模型没标 branch 时按出边顺序补 if-true / else', () => {
    const g = normalizeGraph(branchy)
    const out = g.edges.filter((x) => x.source === 'c').map((x) => x.sourceHandle)
    expect(out).toEqual(['if-true', 'else'])
  })

  it('模型标了 branch 就照用', () => {
    const g = normalizeGraph({
      ...branchy,
      edges: [
        { source: 's', target: 'c' },
        { source: 'c', target: 'a', branch: 'else' },
        { source: 'c', target: 'b', branch: 'if-true' },
      ],
    })
    const byTarget = Object.fromEntries(
      g.edges.filter((x) => x.source === 'c').map((x) => [x.target, x.sourceHandle]),
    )
    expect(byTarget).toEqual({ a: 'else', b: 'if-true' })
  })

  it('三条分支 → if-true / elif-1 / else', () => {
    const g = normalizeGraph({
      nodes: [
        { id: 'c', type: 'if-else', label: '判断' },
        { id: 'x', type: 'end' }, { id: 'y', type: 'end' }, { id: 'z', type: 'end' },
      ],
      edges: [{ source: 'c', target: 'x' }, { source: 'c', target: 'y' }, { source: 'c', target: 'z' }],
    })
    expect(g.edges.map((e) => e.sourceHandle)).toEqual(['if-true', 'elif-1', 'else'])
  })

  it('回填 cases，画布才画得出对应的分支出口', () => {
    const g = normalizeGraph(branchy)
    const cases = g.nodes.find((n) => n.id === 'c')?.data?.config?.cases as { caseId: string }[]
    expect(cases.map((c) => c.caseId)).toEqual(['if-true'])
  })

  it('非 if-else 节点的出边不带 sourceHandle', () => {
    const g = normalizeGraph(linear)
    expect(g.edges.every((e) => e.sourceHandle === undefined)).toBe(true)
  })
})

describe('WF-2 定时触发节点', () => {
  it('cron 与时区原样保留，并补出面板要用的 schedule_preset', () => {
    const g = normalizeGraph({
      nodes: [{ id: 't', type: 'trigger-schedule', label: '每天8点触发', config: { cron: '0 8 * * *' } }],
      edges: [],
    })
    expect(g.nodes[0].data?.config).toMatchObject({
      cron: '0 8 * * *', timezone: 'Asia/Shanghai', schedule_preset: 'daily_8am',
    })
  })

  it('cron 缺失或非法 → 回落每天 9 点，不产出跑不了的空表达式', () => {
    const g = normalizeGraph({
      nodes: [{ id: 't', type: 'trigger-schedule', label: '定时', config: { cron: '每天八点' } }],
      edges: [],
    })
    expect(g.nodes[0].data?.config?.cron).toBe('0 9 * * *')
    expect(g.nodes[0].data?.config?.schedule_preset).toBe('daily_9am')
  })
})

describe('脏数据不炸', () => {
  it('缺 id/type 的节点被丢弃，悬空边不影响其余节点', () => {
    const g = normalizeGraph({
      nodes: [{ id: '', type: 'llm' }, { id: 'l', type: '' }, { id: 'ok', type: 'end', label: '结束' }],
      edges: [{ source: 'ghost', target: 'ok' }, { source: '', target: '' }],
    })
    expect(g.nodes.map((n) => n.id)).toEqual(['ok'])
    expect(g.nodes[0].position).toBeDefined()
  })
})
