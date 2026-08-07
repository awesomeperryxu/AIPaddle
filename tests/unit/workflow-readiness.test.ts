/**
 * L2 测试 · WF-11 工作流可用性体检（自动创建后先测试、通过再交人工发布）
 *
 * 🔴 图合法 ≠ 跑得起来。用户实测遇到的正是「结构完全合法但发布出去就是坏的」：
 *   · LLM 节点点开是空的——没模型没提示词，跑起来是模型自由发挥；
 *   · HTTP 节点填 `https://api.example-search.com/v1/search` 这种编造地址，一跑就失败。
 * 体检把这些列为发布拦截项，机器先把关，人工再发布。
 */
import { describe, it, expect } from 'vitest'
import { checkReadiness, isUsableUrl, summarizeReadiness } from '@/lib/workflow/readiness'

const node = (id: string, type: string, config: Record<string, unknown> = {}, label = id) => ({
  id, type, data: { label, config },
})
const okLlm = (id = 'llm-1') => node(id, 'llm', {
  prompt: '从以下内容中提炼要点：{{input}}',
  model: { provider: 'qwen', name: 'qwen-plus' },
  prompts: [{ id: 'p', role: 'user', text: '从以下内容中提炼要点：{{input}}' }],
}, '提炼要点')

const graphOf = (...nodes: ReturnType<typeof node>[]) => ({ nodes, edges: [] })

describe('LLM 节点', () => {
  it('提示词齐全 → 通过', () => {
    const r = checkReadiness(graphOf(okLlm()))
    expect(r.ready).toBe(true)
    expect(r.issues).toHaveLength(0)
  })

  it('没有提示词 → error，拦住发布', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {})))
    expect(r.ready).toBe(false)
    expect(r.issues[0]).toMatchObject({ level: 'error', code: 'llm_no_prompt' })
  })

  it('只在面板 prompts[] 里写了提示词也算齐全', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {
      prompts: [{ id: 'p', role: 'user', text: '请总结以下内容并给出要点' }],
      model: { provider: 'qwen', name: 'qwen-plus' },
    })))
    expect(r.ready).toBe(true)
  })

  it('未指定模型只是 warn，不拦发布（会退到系统默认模型）', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', { prompt: '请总结以下内容的要点' })))
    expect(r.ready).toBe(true)
    expect(r.issues.map((i) => i.code)).toContain('llm_no_model')
  })

  it('label 标了「需接入」的降级节点 → error，它其实没有对应能力', () => {
    // 这类节点若同时提到检索/抓取，会被上一条更具体的规则（llm_no_data_source）接管；
    // 两条同源，只报一条——重点是**必须被拦住**。
    const r = checkReadiness(graphOf(
      node('llm-1', 'llm', { prompt: '检索全网AI资讯并汇总' }, '联网检索（需接入能力，请手动挂载）'),
    ))
    expect(r.ready).toBe(false)
    expect(r.issues.filter((i) => i.level === 'error')).toHaveLength(1)
    expect(r.issues[0].code).toBe('llm_no_data_source')
  })

  it('不涉及取数、但标了「需接入」→ 由 placeholder 规则拦住', () => {
    const r = checkReadiness(graphOf(
      node('llm-1', 'llm', { prompt: '把结果发送到企业微信群' }, '推送到企业微信（需接入消息推送能力）'),
    ))
    expect(r.ready).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain('llm_placeholder_capability')
  })
})

describe('HTTP 节点的假地址', () => {
  it.each([
    'https://api.example-search.com/v1/search',
    'https://example.com/api',
    'https://your-api.com/x',
    '<YOUR_ENDPOINT>',
    'TODO',
  ])('%s → error', (url) => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { url, method: 'GET' })))
    expect(r.ready).toBe(false)
    expect(r.issues[0].code).toBe('http_placeholder_url')
  })

  it('真实地址 → 通过', () => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { url: 'https://newsapi.org/v2/everything', method: 'GET' })))
    expect(r.ready).toBe(true)
  })

  it('地址为空 → error', () => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { method: 'GET' })))
    expect(r.issues[0].code).toBe('http_no_url')
  })
})

describe('其它节点', () => {
  it('tool 未绑定 Skill → error', () => {
    const r = checkReadiness(graphOf(node('tool-1', 'tool', {})))
    expect(r.issues[0].code).toBe('tool_unbound')
  })

  it('if-else 条件为空 → error（引擎里恒走 ELSE，等于分支没生效）', () => {
    const r = checkReadiness(graphOf(node('if-1', 'if-else', {
      cases: [{ caseId: 'if-true', conditions: [] }],
    })))
    expect(r.issues[0].code).toBe('ifelse_no_condition')
  })

  it('if-else 填了条件 → 通过', () => {
    const r = checkReadiness(graphOf(node('if-1', 'if-else', {
      cases: [{ caseId: 'if-true', conditions: [{ conditions: [{ variable: ['llm-1'], operator: 'contains', value: 'AI' }] }] }],
    })))
    expect(r.ready).toBe(true)
  })

  it('知识库检索未选库 → error', () => {
    const r = checkReadiness(graphOf(node('kb-1', 'knowledge-retrieval', { dataset_ids: [] })))
    expect(r.issues[0].code).toBe('kb_unbound')
  })

  it('start/end 不参与体检，空图也不报错', () => {
    const r = checkReadiness(graphOf(node('s', 'start'), node('e', 'end')))
    expect(r.ready).toBe(true)
    expect(r.checked).toBe(2)
  })
})

describe('isUsableUrl', () => {
  it('只认 http(s) 绝对地址', () => {
    expect(isUsableUrl('https://a.com')).toBe(true)
    expect(isUsableUrl('http://a.com/x?y=1')).toBe(true)
    expect(isUsableUrl('ftp://a.com')).toBe(false)
    expect(isUsableUrl('/relative/path')).toBe(false)
    expect(isUsableUrl('')).toBe(false)
  })
})

describe('WF-21 声称联网取数却没有数据源', () => {
  // 🔴 用户实测：「查全网当天 AI 大事件」生成出的是一个干净的 llm 节点「抓取前一日的AI大事件」，
  // 没有任何「需接入」标记。跑起来模型无从检索，输出了一整篇 2024 年的假报告 + 自白。
  // 生成规则压不住的坏模式，只能在这里用确定性规则拦。
  const fetchNews = (label: string) => node('llm-1', 'llm', {
    prompt: '整理要点：{{input}}',
    model: { provider: 'qwen', name: 'qwen-plus' },
  }, label)

  it.each([
    '抓取前一日的AI大事件',
    '检索全网AI资讯',
    '搜索最新新闻',
    '联网获取当天动态',
    '采集舆情数据',
  ])('「%s」+ 全图无数据源 → error', (label) => {
    const r = checkReadiness(graphOf(node('start-1', 'start'), fetchNews(label), node('end-1', 'end')))
    expect(r.ready).toBe(false)
    expect(r.issues.some((i) => i.code === 'llm_no_data_source' && i.level === 'error')).toBe(true)
  })

  it('图里有 tool 节点提供数据源 → 不再报这一项', () => {
    const r = checkReadiness(graphOf(
      node('tool-1', 'tool', { tool_id: 'skill-abc' }, '联网搜索'),
      fetchNews('整理抓取到的AI大事件'),
    ))
    expect(r.issues.some((i) => i.code === 'llm_no_data_source')).toBe(false)
  })

  it('图里有 http-request 提供数据源 → 不报', () => {
    const r = checkReadiness(graphOf(
      node('http-1', 'http-request', { url: 'https://news.example.org/api/v1/list' }, '拉取新闻'),
      fetchNews('抓取当天资讯'),
    ))
    expect(r.issues.some((i) => i.code === 'llm_no_data_source')).toBe(false)
  })

  it('纯加工步骤不误伤——「筛选重要事件并摘要」不含取数动词', () => {
    const r = checkReadiness(graphOf(node('start-1', 'start'), okLlm(), node('end-1', 'end')))
    expect(r.issues.some((i) => i.code === 'llm_no_data_source')).toBe(false)
  })
})

describe('摘要文案', () => {
  it('未通过时说清有几项必须处理', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {}), node('http-1', 'http-request', {})))
    expect(summarizeReadiness(r)).toContain('2 项必须处理')
  })

  it('通过时给出节点数', () => {
    expect(summarizeReadiness(checkReadiness(graphOf(okLlm())))).toContain('体检通过')
  })
})

describe('WF-22 联网搜索开关', () => {
  // 用户实测：「查全网当天AI大事件」被拦，且同一节点报了两条重复的错。
  // 平台其实有联网能力（通义原生支持），开关一开这一步就是真联网取数——
  // 这是「解决」而非「放行」。
  const webNode = (on: boolean) => node('llm-1', 'llm', {
    prompt: '检索并列出昨天全球AI领域的重大事件，注明日期与来源',
    model: { provider: 'qwen', name: 'qwen-plus' },
    ...(on ? { enableSearch: true } : {}),
  }, '抓取前一日的AI大事件')

  it('开了联网搜索 → 通过体检，不再拦发布', () => {
    const r = checkReadiness(graphOf(webNode(true)))
    expect(r.ready).toBe(true)
  })

  it('没开 → 仍然拦住（否则跑出来是编的）', () => {
    const r = checkReadiness(graphOf(webNode(false)))
    expect(r.ready).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain('llm_no_data_source')
  })

  it('🔴 同一节点不再报两条重复的错', () => {
    // 用户看到的正是这个：「需接入」标记 + 「没有数据源」两条，内容重叠
    const n = node('llm-1', 'llm', { prompt: '检索昨日AI大事件并汇总要点' }, '抓取前一日的AI大事件（需接入实时资讯检索能力）')
    const errs = checkReadiness(graphOf(n)).issues.filter((i) => i.level === 'error')
    expect(errs).toHaveLength(1)
    expect(errs[0].code).toBe('llm_no_data_source')
    expect(errs[0].message).toContain('联网搜索')
  })

  it('开了联网搜索的节点也为全图提供数据源，下游整理节点不再被误判', () => {
    const r = checkReadiness(graphOf(
      webNode(true),
      node('llm-2', 'llm', { prompt: '从抓取到的资讯里筛选重要事件并摘要', model: { provider: 'qwen', name: 'qwen-plus' } }, '筛选重要事件并摘要'),
    ))
    expect(r.ready).toBe(true)
  })
})
