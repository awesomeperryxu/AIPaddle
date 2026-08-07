/**
 * L2 测试 · Copilot 产出图的规范化（WF-7 / WF-5 / WF-6 / WF-2b）
 *
 * 用户实测反馈：AI 生成 6 个节点后「都堆叠在一起，拉开以后也毫无逻辑」。
 * 三个独立缺陷叠加：
 *   ① 节点没有 position → 全部落到同一个 DEFAULT_POS，严格重叠；
 *   ② 模型输出的是顶层 label，而 graph-adapter 读 data.label → 画布上只显示
 *      "llm"/"end" 这种类型名，看不出每一步在干什么；
 *   ③ if-else 出边没有 sourceHandle → 既挂不上画布的 IF/ELSE 句柄，
 *      执行引擎也永远匹配不到分支，流程跑到判断处就断。
 * 外加 WF-24（推翻 WF-2b）：「每天早上 8 点」既不落成节点、**也不再进图的元数据**——
 * 定时以 Agent / 数字员工 / 团队 为单位配置，工作流只描述「跑什么」（见 ADR-022）。
 */
import { describe, it, expect } from 'vitest'
import { normalizeGraph, sanitizeToolNodes, collapseFillerNodes, type RawGraph } from '@/lib/workflow/copilot'

const linear: RawGraph = {
  nodes: [
    { id: 's', type: 'start', label: '开始' },
    { id: 'l', type: 'llm', label: '提炼要点', config: { prompt: '总结：{{input}}' } },
    { id: 'e', type: 'end', label: '输出结果' },
  ],
  edges: [{ source: 's', target: 'l' }, { source: 'l', target: 'e' }],
}

describe('WF-7 节点位置', () => {
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
    expect(g.nodes[1].data?.config).toMatchObject({ prompt: '总结：{{input}}' })
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

describe('WF-24 工作流不承载定时', () => {
  // 🔴 推翻 WF-2b：定时既不占画布节点，**也不再进图的元数据**。
  // 用户拍板：定时只能以 Agent / 数字员工 / 团队 为单位配置（见 ADR-022）。
  // 模型即便仍输出 schedule，规范化后也必须落不进图——否则会出现两套互不知情的调度口径。
  it('模型给了 schedule 也不落进图，且不产生定时节点', () => {
    const g = normalizeGraph({
      nodes: [{ id: 's', type: 'start', label: '开始' }, { id: 'e', type: 'end', label: '结束' }],
      edges: [{ source: 's', target: 'e' }],
      schedule: { enabled: true, cron: '0 8 * * *', timezone: 'Asia/Shanghai' },
    } as RawGraph & { schedule: unknown })
    expect('schedule' in g).toBe(false)
    expect(g.nodes.map((n) => n.type)).toEqual(['start', 'end'])
    expect(g.nodes.some((n) => n.type.startsWith('trigger'))).toBe(false)
  })

  it('正常图只有 nodes / edges 两个键', () => {
    const g = normalizeGraph(linear)
    expect(Object.keys(g).sort()).toEqual(['edges', 'nodes'])
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

describe('schedule 残留不污染图', () => {
  it('脏数据里的 schedule 被丢弃，布局照常完成', () => {
    const g = normalizeGraph({
      nodes: [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }],
      edges: [{ source: 's', target: 'e' }],
      schedule: { enabled: false, cron: '0 9 * * 1', timezone: 'UTC' },
    } as RawGraph & { schedule: unknown })
    expect('schedule' in g).toBe(false)
    expect(g.nodes.every((n) => n.position)).toBe(true)
  })
})


describe('WF-10 LLM 节点配置面板不能是空的', () => {
  // 🔴 三个读者字段对不上：引擎读 config.prompt、面板读 config.model + config.prompts[]。
  // 只写 prompt 的话，用户点开生成的 LLM 节点看到的是「模型和提示词全空」，
  // 在面板里随手一存反而会把引擎要用的 prompt 覆盖掉。
  const withPrompt = () => normalizeGraph({
    nodes: [{ id: 'llm-1', type: 'llm', label: '筛选并摘要', config: { prompt: '整理要点：{{input}}' } }],
    edges: [],
  }).nodes[0].data!.config as Record<string, unknown>

  it('同时写出面板要读的 model 与 prompts', () => {
    const cfg = withPrompt()
    expect(cfg.model).toMatchObject({ provider: expect.any(String), name: expect.any(String) })
    expect(cfg.prompts).toEqual([{ id: 'llm-1-p1', role: 'user', text: '整理要点：{{input}}' }])
  })

  it('两种形态文本一致，面板与引擎读到的是同一句', () => {
    const cfg = withPrompt()
    expect((cfg.prompts as { text: string }[])[0].text).toBe(cfg.prompt)
  })

  it('模型只给了 prompts[] 时反向补出引擎要用的 prompt', () => {
    const g = normalizeGraph({
      nodes: [{ id: 'llm-1', type: 'llm', label: 'x', config: { prompts: [{ id: 'p', role: 'user', text: '来自面板的提示词' }] } }],
      edges: [],
    })
    expect(g.nodes[0].data?.config?.prompt).toBe('来自面板的提示词')
  })

  it('完全没有提示词时不硬造，交给体检报「待补」', () => {
    const g = normalizeGraph({ nodes: [{ id: 'llm-1', type: 'llm', label: 'x' }], edges: [] })
    expect(g.nodes[0].data?.config?.prompt).toBeUndefined()
  })
})

describe('WF-12 编造的假 URL 必须被拦下', () => {
  const urlOf = (url: string) => {
    const g = sanitizeToolNodes(
      { nodes: [{ id: 'http-1', type: 'http-request', label: '搜索资讯', config: { url, method: 'GET' } }], edges: [] },
      new Set<string>(),
    )
    return g.nodes[0]
  }

  it.each([
    'https://api.example-search.com/v1/search',
    'https://example.com/api',
    'https://your-api.com/search',
    'https://api.placeholder.io/v1',
    '<YOUR_API_ENDPOINT>',
    'not-a-url',
  ])('占位地址 %s → 清空并标注需人工填写', (url) => {
    const n = urlOf(url)
    expect(n.config?.url).toBe('')
    expect(n.label).toContain('需人工填写')
  })

  it('真实地址原样保留', () => {
    const n = urlOf('https://newsapi.org/v2/everything?q=ai')
    expect(n.config?.url).toBe('https://newsapi.org/v2/everything?q=ai')
    expect(n.label).toBe('搜索资讯')
  })
})

describe('WF-14 折叠臆想的中间步骤', () => {
  // 用户实测抱怨：生成出「生成昨日AI大事件关键词」这种节点，他要的是业务步骤不是模型的内心独白。
  // prompt 明令禁止后仍复发（实测两轮都犯），故做确定性折叠。
  const chain = (labels: [string, string][]): RawGraph => ({
    nodes: [
      { id: 's', type: 'start', label: '开始' },
      ...labels.map(([id, label]) => ({ id, type: 'llm', label, config: { prompt: `${label}的提示词` } })),
      { id: 'e', type: 'end', label: '结束' },
    ],
    edges: [
      { source: 's', target: labels[0][0] },
      ...labels.slice(0, -1).map((l, i) => ({ source: l[0], target: labels[i + 1][0] })),
      { source: labels[labels.length - 1][0], target: 'e' },
    ],
  })

  it('「生成检索关键词」被折叠，链路自动接上', () => {
    const g = collapseFillerNodes(chain([['a', '生成检索关键词'], ['b', '筛选重要事件并摘要']]))
    expect(g.nodes.map((n) => n.id)).toEqual(['s', 'b', 'e'])
    expect(g.edges).toContainEqual({ source: 's', target: 'b' })
  })

  it('折叠不丢信息：提示词并进下游节点', () => {
    const g = collapseFillerNodes(chain([['a', '推断昨天的日期'], ['b', '汇总昨日资讯']]))
    const b = g.nodes.find((n) => n.id === 'b')!
    expect(String(b.config?.prompt)).toContain('推断昨天的日期的提示词')
    expect(String(b.config?.prompt)).toContain('汇总昨日资讯的提示词')
  })

  it.each(['构造查询语句', '准备请求参数', '生成搜索关键字', '计算时间范围'])('%s 同样折叠', (label) => {
    const g = collapseFillerNodes(chain([['a', label], ['b', '汇总']]))
    expect(g.nodes.map((n) => n.id)).toEqual(['s', 'b', 'e'])
  })

  it('真业务步骤不动', () => {
    const g = collapseFillerNodes(chain([['a', '抓取前一日的AI资讯'], ['b', '筛选重要事件并摘要']]))
    expect(g.nodes.map((n) => n.id)).toEqual(['s', 'a', 'b', 'e'])
  })

  it('分叉节点不折叠——多出边时接线无从还原，宁可留着', () => {
    const g = collapseFillerNodes({
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a', type: 'llm', label: '生成检索关键词' },
        { id: 'b', type: 'llm', label: '路线一' },
        { id: 'c', type: 'llm', label: '路线二' },
      ],
      edges: [{ source: 's', target: 'a' }, { source: 'a', target: 'b' }, { source: 'a', target: 'c' }],
    })
    expect(g.nodes.map((n) => n.id)).toContain('a')
  })

  it('非 llm 节点即便同名也不折叠', () => {
    const g = collapseFillerNodes({
      nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'code', label: '生成检索关键词' }, { id: 'e', type: 'end' }],
      edges: [{ source: 's', target: 'a' }, { source: 'a', target: 'e' }],
    })
    expect(g.nodes.map((n) => n.id)).toContain('a')
  })
})

describe('WF-22 生成时自动开联网搜索', () => {
  const cfgOf = (label: string, prompt: string) =>
    normalizeGraph({ nodes: [{ id: 'llm-1', type: 'llm', label, config: { prompt } }], edges: [] })
      .nodes[0].data!.config as Record<string, unknown>

  it.each([
    ['抓取前一日的AI大事件', '列出昨天的AI大事件'],
    ['检索最新行业动态', '汇总本周动态'],
    ['全网搜集用户反馈', '整理反馈'],
  ])('「%s」→ 自动开启 enableSearch', (label, prompt) => {
    expect(cfgOf(label, prompt).enableSearch).toBe(true)
  })

  it('纯加工步骤不开——没必要为「摘要」去联网', () => {
    expect(cfgOf('筛选重要事件并摘要', '从以下内容提炼要点：{{input}}').enableSearch).toBeUndefined()
  })

  it('模型自己开了就尊重它', () => {
    const g = normalizeGraph({
      nodes: [{ id: 'llm-1', type: 'llm', label: '写周报', config: { prompt: '写一篇周报', enableSearch: true } }],
      edges: [],
    })
    expect(g.nodes[0].data?.config?.enableSearch).toBe(true)
  })
})
